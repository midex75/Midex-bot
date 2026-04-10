const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  getContentType,
  DisconnectReason,
} = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");

function getText(message) {
  const type = getContentType(message);
  if (!type) return "";

  if (type === "conversation") return message.conversation || "";
  if (type === "extendedTextMessage") return message.extendedTextMessage?.text || "";
  if (type === "imageMessage") return message.imageMessage?.caption || "";
  if (type === "videoMessage") return message.videoMessage?.caption || "";

  return "";
}

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
    browser: ["Midex Bot", "Chrome", "1.0.0"],
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("\nScan this QR with WhatsApp > Linked devices\n");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "open") {
      console.log("✅ Bot connected successfully.");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log("❌ Connection closed.");
      if (shouldReconnect) startBot();
    }
  });

  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id, participants, action } = update;

      if (action === "add") {
        for (const user of participants) {
          await sock.sendMessage(id, {
            text: `Welcome 🥳☺️ @${user.split("@")[0]} to *Laughing Reapers* family ❤️

You are now adopted to the family 🧑‍🧑‍🧒‍🧒  
We highly appreciate you for joining us, so with that being said…..

📌 Read rules: type .rules  
🎮 Stay active  
🔥 Enjoy the community`,
            mentions: [user],
          });
        }
      }

      if (action === "remove") {
        for (const user of participants) {
          await sock.sendMessage(id, {
            text: `😔 @${user.split("@")[0]} has left the *Laughing Reapers* family.

We wish you the best 👋`,
            mentions: [user],
          });
        }
      }
    } catch (err) {
      console.log("Group participant update error:", err);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    try {
      if (type !== "notify") return;

      const msgObj = messages[0];
      if (!msgObj?.message) return;

      const from = msgObj.key.remoteJid;
      const text = getText(msgObj.message).trim().toLowerCase();

      if (!text) return;

      console.log("Message received:", text);

      const isGroup = from.endsWith("@g.us");
      const sender = msgObj.key.participant || msgObj.key.remoteJid;

      let isAdmin = false;

      if (isGroup) {
        const metadata = await sock.groupMetadata(from);
        const admins = metadata.participants
          .filter((p) => p.admin)
          .map((p) => p.id);

        isAdmin = admins.includes(sender);
      }

      if (text === ".ping") {
        await sock.sendMessage(from, {
          text: "Pong 🏓 Bot is working!",
        });
      }

      if (text === ".help" || text === ".menu") {
        await sock.sendMessage(from, {
          text: `📜 *MIDEX BOT MENU*

⚙️ Basic Commands
.ping
.help
.menu
.rules
.tagall

👥 Group Commands
.open
.close

🤖 Auto Features
- Welcome message
- Goodbye message
- Simple greetings reply`,
        });
      }

      if (text === ".rules") {
        await sock.sendMessage(from, {
          text: `📌 *Group Rules*

1. Respect everyone
2. No spam
3. No fighting
4. No unwanted links
5. Follow admin instructions`,
        });
      }

      if (text === ".tagall") {
        if (!isGroup) {
          await sock.sendMessage(from, { text: "❌ This command works in groups only." });
          return;
        }

        if (!isAdmin) {
          await sock.sendMessage(from, { text: "❌ Admin only command." });
          return;
        }

        const metadata = await sock.groupMetadata(from);
        const mentions = metadata.participants.map((p) => p.id);

        let messageText = "📢 Attention everyone:\n\n";
        for (const user of mentions) {
          messageText += `@${user.split("@")[0]}\n`;
        }

        await sock.sendMessage(from, {
          text: messageText,
          mentions,
        });
      }

      if (text === ".close") {
        if (!isGroup) {
          await sock.sendMessage(from, { text: "❌ This command works in groups only." });
          return;
        }

        if (!isAdmin) {
          await sock.sendMessage(from, { text: "❌ Admin only command." });
          return;
        }

        await sock.groupSettingUpdate(from, "announcement");
        await sock.sendMessage(from, {
          text: "🔒 Group closed. Only admins can send messages.",
        });
      }

      if (text === ".open") {
        if (!isGroup) {
          await sock.sendMessage(from, { text: "❌ This command works in groups only." });
          return;
        }

        if (!isAdmin) {
          await sock.sendMessage(from, { text: "❌ Admin only command." });
          return;
        }

        await sock.groupSettingUpdate(from, "not_announcement");
        await sock.sendMessage(from, {
          text: "🔓 Group opened. Everyone can send messages.",
        });
      }

      if (text === "hi" || text === "hello" || text === "good morning") {
        await sock.sendMessage(from, {
          text: "👋 Hello, I’m Midex Bot.",
        });
      }
    } catch (err) {
      console.log("Message handler error:", err);
    }
  });
}

startBot();