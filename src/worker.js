// Telegram Instagram Downloader - Simple & Direct
// توکن تلگرام قبلاً تنظیم شده است

const TELEGRAM_BOT_TOKEN = "7958943807:AAFuDpN2EfStl-AISQL1K41mZ_ogK-kKY7M";
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// دانلود اینستاگرام
async function downloadInstagram(url) {
  try {
    if (!url.includes("instagram.com")) {
      return { success: false, error: "❌ لینک اینستاگرام نیست!" };
    }

    const cleanUrl = url.split("?")[0];
    const mediaUrl = cleanUrl.endsWith("/") 
      ? cleanUrl + "?__a=1&__w=1" 
      : cleanUrl + "/?__a=1&__w=1";

    const response = await fetch(mediaUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (!response.ok) {
      // اگر نشد، از سرویس کمکی استفاده کن
      return await downloadViaService(cleanUrl);
    }

    const data = await response.json();
    const media = extractMedia(data);
    
    if (!media) {
      return await downloadViaService(cleanUrl);
    }

    return { success: true, media: media, type: media.type };

  } catch (error) {
    console.error("Error:", error);
    return await downloadViaService(url);
  }
}

// استخراج media
function extractMedia(data) {
  try {
    const items = data?.items || data?.data?.user?.edge_user_to_photos_of_media?.edges || [];
    
    if (items.length === 0) return null;

    const item = items[0]?.node || items[0];
    
    if (item.is_video || item.__typename === "GraphVideo") {
      return {
        type: "video",
        url: item.video_url || item.media?.video_url
      };
    }
    
    if (item.display_url || item.media?.image_url) {
      return {
        type: "image",
        url: item.display_url || item.media?.image_url
      };
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Backup دانلود
async function downloadViaService(url) {
  try {
    const services = [
      `https://api.direkt.link/instagram/?url=${encodeURIComponent(url)}`,
    ];

    for (const service of services) {
      try {
        const response = await fetch(service, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          if (data.media || data.url || data.video_url || data.image_url) {
            return {
              success: true,
              media: {
                type: data.type || (data.video_url ? "video" : "image"),
                url: data.media || data.url || data.video_url || data.image_url
              }
            };
          }
        }
      } catch (e) {
        continue;
      }
    }

    return { success: false, error: "❌ نتوانستم دانلود کنم" };
  } catch (error) {
    return { success: false, error: "❌ خطای سرویس" };
  }
}

// ارسال پیام
async function sendMessage(chatId, text) {
  return fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: "HTML"
    })
  });
}

// ارسال عکس
async function sendPhoto(chatId, photoUrl, caption = "") {
  return fetch(`${TELEGRAM_API_URL}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption,
      parse_mode: "HTML"
    })
  });
}

// ارسال ویدئو
async function sendVideo(chatId, videoUrl, caption = "") {
  return fetch(`${TELEGRAM_API_URL}/sendVideo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption: caption,
      parse_mode: "HTML"
    })
  });
}

// پردازش پیام
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || "";
  const userName = message.from.first_name || "کاربر";

  if (text === "/start") {
    await sendMessage(
      chatId,
      `سلام <b>${userName}</b>! 👋\n\n` +
      `لینک اینستاگرام بفرست و من برایت دانلود می‌کنم! 📸\n\n` +
      `مثال: https://www.instagram.com/p/ABC123xyz/`
    );
    return;
  }

  if (text.includes("instagram.com")) {
    await sendMessage(chatId, "⏳ درحال دانلود...");

    const result = await downloadInstagram(text);

    if (!result.success) {
      await sendMessage(chatId, result.error);
      return;
    }

    if (result.type === "video") {
      await sendVideo(chatId, result.media.url, "✅ ویدئو دانلود شد!");
    } else {
      await sendPhoto(chatId, result.media.url, "✅ عکس دانلود شد!");
    }
    return;
  }

  await sendMessage(chatId, "❌ لطفاً لینک اینستاگرام بفرستید!");
}

// Cloudflare Worker
export default {
  async fetch(request) {
    if (request.method !== "POST") {
      return new Response("OK", { status: 200 });
    }

    try {
      const update = await request.json();
      if (update.message) {
        await handleMessage(update.message);
      }
      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("Error:", error);
      return new Response("Error", { status: 500 });
    }
  }
};
