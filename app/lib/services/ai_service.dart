import '../core/api.dart';
import '../models/templates.dart';

enum AiEngine { auto, chatgpt, claude, meta, gemini }

class ChatMessage {
  final String role; // user | assistant
  final String text;
  final String? engine;
  final String? imageBase64;
  final DateTime at;
  ChatMessage(this.role, this.text, {this.engine, this.imageBase64, DateTime? at}) : at = at ?? DateTime.now();

  Map<String, dynamic> toJson() => {'role': role, 'content': text, if (engine != null) 'engine': engine};
}

class AiReply {
  final String text;
  final String engine;
  final bool offline;
  AiReply(this.text, this.engine, {this.offline = false});
}

/// Router + fallback. The server does provider routing, BYOK, plan checks and
/// tries the next AI if one fails (3 attempts). The client keeps one shared
/// history so switching AI mid-conversation continues the same chat.
class AiService {
  static String engineName(AiEngine e) => e.name;

  /// Client-side auto route (mirrors server): code->Claude, image->Gemini,
  /// writing->ChatGPT, everything else->Meta (free & fast).
  static AiEngine autoRoute(String text, {bool hasImage = false}) {
    final t = text.toLowerCase();
    if (hasImage || RegExp(r'(صورة|صور|فيديو|image|photo|picture|video|draw|ارسم)').hasMatch(t)) return AiEngine.gemini;
    if (RegExp(r'(كود|برمج|برنامج|تطبيق|bug|code|program|function|flutter|python|javascript|api|error|خطأ)').hasMatch(t)) {
      return AiEngine.claude;
    }
    if (RegExp(r'(اكتب|مقال|قصة|قصيدة|إعلان|اعلان|تسويق|write|essay|story|poem|marketing|caption|email)').hasMatch(t)) {
      return AiEngine.chatgpt;
    }
    return AiEngine.meta;
  }

  static Future<AiReply> chat({
    required List<ChatMessage> history,
    required AiEngine engine,
    required String lang,
    String? chatId,
    bool voiceReply = false,
  }) async {
    final last = history.last;
    final chosen = engine == AiEngine.auto ? autoRoute(last.text, hasImage: last.imageBase64 != null) : engine;
    try {
      final res = await Api.post('/ai/chat', {
        'engine': chosen.name,
        'lang': lang,
        'chatId': chatId,
        'messages': history.map((m) => m.toJson()).toList(),
        if (voiceReply) 'voiceReply': true,
        if (last.imageBase64 != null) 'image': last.imageBase64,
      }, timeout: const Duration(seconds: 90));
      return AiReply((res['text'] ?? '').toString(), (res['engine'] ?? chosen.name).toString());
    } catch (_) {
      return AiReply(_offlineReply(last.text, lang), chosen.name, offline: true);
    }
  }

  /// Offline reply — always useful, never "I can't".
  static String _offlineReply(String text, String lang) {
    final ar = lang == 'ar';
    if (looksLikeAppRequest(text)) {
      return ar
          ? 'تمام! جهزت لك معاينة فورية للتطبيق. اضغط "ابنِ هذا التطبيق" تحت وبنكمل بثلاث أسئلة بسيطة.'
          : 'Great! I prepared an instant preview. Tap "Build this app" below and we will finish with 3 quick questions.';
    }
    return ar
        ? 'وصلتني رسالتك ✅\nعندك 3 خيارات الحين:\n1) ابنِ تطبيق من فكرتك في المنشئ\n2) حوّل قصة لفيديو في تبويب الفيديو\n3) صوّر أي شي بالكاميرا ونحوله لتطبيق\n(اربط مفاتيح الذكاء الاصطناعي في الإعدادات للردود الكاملة)'
        : 'Got your message ✅\nYou have 3 options right now:\n1) Build an app from your idea in Builder\n2) Turn a story into a video in Video\n3) Snap anything with the camera and turn it into an app\n(Connect AI keys in Settings for full answers)';
  }

  static Future<String> translate(String text, String target) async {
    try {
      final res = await Api.post('/translate', {'text': text, 'target': target});
      return (res['text'] ?? text).toString();
    } catch (_) {
      return text;
    }
  }
}
