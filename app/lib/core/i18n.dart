import 'dart:convert';
import 'dart:ui' as ui;

import 'package:shared_preferences/shared_preferences.dart';

import 'api.dart';

/// Auto language detection — there is no language picker anywhere.
/// 1. Device locale on first launch.
/// 2. Script of what the user types / says (detectFromText).
/// 3. Explicit commands: "تكلم فرنسي", "speak French", "parle anglais"...
/// Arabic + English strings are bundled. Every other language is translated
/// on the fly by the backend (/translate) and cached on device.
class I18n {
  static const rtlLangs = {'ar', 'fa', 'ur', 'he', 'ps', 'ku'};
  static bool isRtl(String lang) => rtlLangs.contains(lang);

  static String deviceLanguage() {
    final code = ui.PlatformDispatcher.instance.locale.languageCode;
    return code.isEmpty ? 'en' : code;
  }

  /// Script-based detection that works offline for the main world scripts.
  static String? detectFromText(String text) {
    final t = text.trim();
    if (t.length < 2) return null;
    int arabic = 0, persianOnly = 0, urduOnly = 0, devanagari = 0, bengali = 0;
    int cjk = 0, kana = 0, hangul = 0, cyrillic = 0, latin = 0, greek = 0, hebrew = 0, thai = 0;
    for (final r in t.runes) {
      if (r >= 0x0600 && r <= 0x06FF) {
        arabic++;
        if (r == 0x067E || r == 0x0686 || r == 0x0698 || r == 0x06AF) persianOnly++;
        if (r == 0x0679 || r == 0x0688 || r == 0x0691 || r == 0x06BA || r == 0x06D2) urduOnly++;
      } else if (r >= 0x0900 && r <= 0x097F) {
        devanagari++;
      } else if (r >= 0x0980 && r <= 0x09FF) {
        bengali++;
      } else if (r >= 0x3040 && r <= 0x30FF) {
        kana++;
      } else if (r >= 0x4E00 && r <= 0x9FFF) {
        cjk++;
      } else if (r >= 0xAC00 && r <= 0xD7AF) {
        hangul++;
      } else if (r >= 0x0400 && r <= 0x04FF) {
        cyrillic++;
      } else if (r >= 0x0370 && r <= 0x03FF) {
        greek++;
      } else if (r >= 0x0590 && r <= 0x05FF) {
        hebrew++;
      } else if (r >= 0x0E00 && r <= 0x0E7F) {
        thai++;
      } else if ((r >= 0x41 && r <= 0x5A) || (r >= 0x61 && r <= 0x7A) || (r >= 0xC0 && r <= 0x24F)) {
        latin++;
      }
    }
    final scores = <String, int>{
      'ar': arabic - persianOnly - urduOnly,
      'hi': devanagari,
      'bn': bengali,
      'ja': kana > 0 ? kana + cjk : 0,
      'zh': kana == 0 ? cjk : 0,
      'ko': hangul,
      'ru': cyrillic,
      'el': greek,
      'he': hebrew,
      'th': thai,
    };
    if (urduOnly > 0) return 'ur';
    if (persianOnly > 0) return 'fa';
    final best = scores.entries.reduce((a, b) => a.value >= b.value ? a : b);
    if (best.value > 0 && best.value >= latin) return best.key;
    if (latin > 0) return _latinGuess(t.toLowerCase());
    return null;
  }

  static String _latinGuess(String t) {
    bool has(List<String> w) => w.any((x) => RegExp('(^|\\W)$x(\\W|\$)').hasMatch(t));
    if (has(['le', 'la', 'les', 'je', 'bonjour', 'merci', 'est', 'une', 'avec'])) return 'fr';
    if (has(['el', 'los', 'hola', 'gracias', 'quiero', 'una', 'para', 'por'])) return 'es';
    if (has(['der', 'die', 'das', 'und', 'ich', 'nicht', 'danke', 'hallo'])) return 'de';
    if (has(['ve', 'bir', 'merhaba', 'teşekkürler', 'istiyorum', 'için'])) return 'tr';
    if (has(['saya', 'dan', 'yang', 'terima', 'kasih', 'ingin', 'aku'])) return 'id';
    if (has(['o', 'você', 'obrigado', 'olá', 'não', 'quero'])) return 'pt';
    if (has(['il', 'ciao', 'grazie', 'sono', 'voglio', 'della'])) return 'it';
    if (has(['main', 'hai', 'kya', 'mujhe', 'nahi', 'chahiye'])) return 'hi';
    return 'en';
  }

  /// "تكلم فرنسي" / "speak french" / "habla español" -> language code.
  static String? detectSwitchCommand(String text) {
    final t = text.toLowerCase();
    final trigger = RegExp(r'(تكلم|تحدث|كلمني|اكتب|speak|talk|reply in|answer in|parle|habla|sprich|konuş)');
    if (!trigger.hasMatch(t)) return null;
    const names = {
      'ar': ['عربي', 'arabic', 'arabe', 'árabe'],
      'en': ['انجليزي', 'إنجليزي', 'english', 'anglais', 'inglés'],
      'fr': ['فرنسي', 'french', 'français', 'francais', 'francés'],
      'es': ['اسباني', 'إسباني', 'spanish', 'español', 'espagnol'],
      'de': ['الماني', 'ألماني', 'german', 'deutsch', 'allemand'],
      'tr': ['تركي', 'turkish', 'türkçe', 'turc'],
      'fa': ['فارسي', 'persian', 'farsi'],
      'ur': ['اوردو', 'أوردو', 'urdu'],
      'hi': ['هندي', 'hindi'],
      'zh': ['صيني', 'chinese', '中文'],
      'ru': ['روسي', 'russian', 'русский'],
      'bn': ['بنغالي', 'bengali', 'bangla'],
      'id': ['اندونيسي', 'إندونيسي', 'indonesian', 'bahasa'],
      'ja': ['ياباني', 'japanese'],
      'ko': ['كوري', 'korean'],
      'it': ['ايطالي', 'إيطالي', 'italian', 'italiano'],
      'pt': ['برتغالي', 'portuguese', 'português'],
    };
    for (final e in names.entries) {
      if (e.value.any(t.contains)) return e.key;
    }
    return null;
  }

  static final Map<String, Map<String, String>> _dynamic = {};

  static Future<void> ensureLoaded(String lang) async {
    if (lang == 'ar' || lang == 'en' || _dynamic.containsKey(lang)) return;
    final prefs = await SharedPreferences.getInstance();
    final cached = prefs.getString('i18n_$lang');
    if (cached != null) {
      _dynamic[lang] = Map<String, String>.from(jsonDecode(cached));
      return;
    }
    try {
      final res = await Api.post('/translate/batch', {
        'target': lang,
        'texts': _strings['en'],
      }, timeout: const Duration(seconds: 25));
      final map = Map<String, String>.from(res['texts'] as Map);
      _dynamic[lang] = map;
      await prefs.setString('i18n_$lang', jsonEncode(map));
    } catch (_) {
      // English is used until translation is available.
    }
  }

  static String t(String lang, String key) {
    return _strings[lang]?[key] ??
        _dynamic[lang]?[key] ??
        _strings['en']![key] ??
        key;
  }

  static const Map<String, Map<String, String>> _strings = {
    'en': {
      'tagline': 'Write what you want — we build your full app',
      'tabLogin': 'Login',
      'tabBuilder': 'Builder',
      'tabVideo': 'Video',
      'tabSettings': 'Settings',
      'chosenAI': 'Selected AI',
      'examplePh': 'Example: I want an app for a clothes shop',
      'buildBtn': 'Build my app',
      'cameraBtn': 'Camera',
      'voiceBtn': 'Real voice reply',
      'liveDemo': 'Live demo design',
      'approveFull': 'I like it — Create the full app',
      'phoneLabel': 'Mobile number',
      'sendActivation': 'Send activation code',
      'codePh': 'Code 123456',
      'loginCode': 'Login with code',
      'forgotSmart': 'Forgot password? — Smart unlock',
      'storyPh': 'Story',
      'makeVideo2': 'Make my video',
      'videoDone': 'Video created',
      'emailLogin': 'Login with email',
      'signedInAs': 'Signed in as',
      'quickQ': '3 quick questions (optional)',
      'editDesign': 'Edit the design',
      'home': 'Home',
      'builder': 'Builder',
      'video': 'Video',
      'settings': 'Settings',
      'oneBoxHint': 'Write what you want… e.g. "I want an app for a clothes shop"',
      'send': 'Send',
      'welcome': 'What do you want to build today?',
      'continueGoogle': 'Continue with Google',
      'continueApple': 'Continue with Apple',
      'continueFacebook': 'Continue with Facebook',
      'continueGithub': 'Continue with GitHub',
      'continuePhone': 'Continue with phone number',
      'continueEmail': 'Continue with email',
      'continueBiometric': 'Unlock with Face ID / Fingerprint',
      'guest': 'Try without account',
      'forgot': 'Forgot password? Smart recovery',
      'phone': 'Phone number (with country code)',
      'email': 'Email',
      'password': 'Password',
      'name': 'Name',
      'sendCode': 'Send code (SMS + WhatsApp + Email)',
      'code': '6-digit code',
      'verify': 'Verify',
      'signIn': 'Sign in',
      'signUp': 'Create account',
      'recoveryTitle': 'Get back in — pick the fastest way',
      'recBiometric': 'Face ID / Fingerprint on this device',
      'recOtp': 'Code to WhatsApp + SMS + Email at once',
      'recMagic': 'Magic link to my email',
      'recDevice': 'Approve from my other device',
      'recQuestions': 'Answer my smart questions',
      'newPassword': 'New password',
      'savePassword': 'Save new password',
      'passwordChanged': 'Password changed. Welcome back!',
      'waitingApproval': 'Open KAKAO on your other device → Settings → Devices and approve.',
      'waitingMagic': 'We sent you a link. Open it on any device — we will log you in here automatically.',
      'identifier': 'Email or phone number',
      'q1': 'What is the shop / app name?',
      'q2': 'Which colors do you like?',
      'q3': 'What do you sell or offer?',
      'next': 'Next',
      'back': 'Back',
      'skip': 'Skip',
      'livePreview': 'Live preview',
      'edit': 'Edit',
      'colors': 'Colors',
      'font': 'Font',
      'images': 'Images',
      'sections': 'Sections',
      'products': 'Products',
      'iLikeIt': 'I like it — Create App',
      'consentTitle': 'Before we create your app',
      'terms': 'I accept the Terms of Service',
      'privacy': 'I accept the Privacy Policy',
      'payment': 'I accept the Payment terms',
      'connectTitle': 'Connect your app',
      'domain': 'Domain (e.g. myshop.com) — optional',
      'whatsapp': 'WhatsApp number for orders',
      'instagram': 'Instagram username',
      'paymentConnect': 'Connect payments (Stripe / BenefitPay)',
      'publish': 'Publish now',
      'publishing': 'Publishing your app…',
      'published': 'Your app is live!',
      'openLink': 'Open link',
      'share': 'Share',
      'copy': 'Copy',
      'copied': 'Copied',
      'storyHint': 'Write your story… we turn it into a full video',
      'makeVideo': 'Make video',
      'duration': 'Length',
      'short': '30–60 sec',
      'long': '1–3 min',
      'videoReady': 'Video ready',
      'download': 'Download',
      'camera': 'Camera',
      'takePhoto': 'Take photo',
      'gallery': 'From gallery',
      'buildFromPhoto': 'Build app from photo',
      'translatePhoto': 'Translate text in photo',
      'scanQr': 'Scan QR / barcode',
      'scanDoc': 'Scan document',
      'idCard': 'Fill signup from ID card',
      'voice': 'Voice',
      'voiceMale': 'Male',
      'voiceFemale': 'Female',
      'voiceBahraini': 'Bahraini',
      'speed': 'Speed',
      'pitch': 'Pitch',
      'volume': 'Volume',
      'testVoice': 'Test voice',
      'autoRead': 'Auto-read replies',
      'cloneVoice': 'Clone my voice (30 sec)',
      'cloneConsent': 'I own this voice and consent to cloning it',
      'record': 'Record',
      'stop': 'Stop',
      'integrations': 'Connections',
      'connect': 'Connect',
      'disconnect': 'Disconnect',
      'connected': 'Connected',
      'apiKeys': 'My own API keys (BYOK)',
      'save': 'Save',
      'saved': 'Saved',
      'plans': 'Plans',
      'free': 'Free',
      'pro': 'Pro',
      'ultra': 'Ultra',
      'upgrade': 'Upgrade',
      'currentPlan': 'Current plan',
      'devices': 'Devices & approvals',
      'approve': 'Approve',
      'deny': 'Deny',
      'security': 'Security',
      'biometricLock': 'Face ID / Fingerprint lock',
      'smartQuestions': 'Smart recovery questions',
      'signOut': 'Sign out',
      'language': 'Language (auto)',
      'languageHint': 'Just write or speak in any language. Say "speak French" to switch.',
      'aiAuto': 'Auto',
      'aiChatgpt': 'ChatGPT',
      'aiClaude': 'Claude',
      'aiMeta': 'Meta AI',
      'aiGemini': 'Gemini',
      'aiChatgptDesc': 'Best for writing',
      'aiClaudeDesc': 'Best for coding',
      'aiMetaDesc': 'Free and fast',
      'aiGeminiDesc': 'Best for images/video',
      'buildThis': 'Build this app',
      'translate': 'Translate',
      'listen': 'Listen',
      'slow': 'Taking longer than usual…',
      'alternatives': 'Meanwhile you can:',
      'retry': 'Try again',
      'useLocal': 'Use instant offline version',
      'freeLimit': 'Free plan includes 3 apps. Upgrade for unlimited apps.',
      'paidFeature': 'This is a Pro feature. Upgrade to unlock it.',
      'myApps': 'My apps',
      'newApp': 'New app',
      'addProduct': 'Add product',
      'price': 'Price',
      'aiImage': 'AI image',
      'upload': 'Upload',
      'cart': 'Cart',
      'checkout': 'Order on WhatsApp',
      'booking': 'Booking',
      'contact': 'Contact',
      'search': 'Search',
      'reviews': 'Reviews',
      'admin': 'Admin',
      'map': 'Map',
      'empty': 'Nothing here yet',
      'profile': 'Profile',
      'enterPhoto': 'Point the camera at a shop, menu, card or product',
      'result': 'Result',
      'useInBuilder': 'Open in builder',
      'sentVia': 'Code sent via',
      'questionsSetup': 'Set 3 questions only you can answer',
      'answer': 'Answer',
      'scenes': 'Scenes',
      'storyboard': 'Storyboard',
      'play': 'Play',
    },
    'ar': {
      'tagline': 'اكتب اللي تبيه… ونسويه لك تطبيق كامل',
      'tabLogin': 'دخول',
      'tabBuilder': 'مصنع',
      'tabVideo': 'فيديو',
      'tabSettings': 'إعدادات',
      'chosenAI': 'الذكاء المختار',
      'examplePh': 'مثال: أبي تطبيق لمحل ثياب',
      'buildBtn': 'ابنِ لي التطبيق',
      'cameraBtn': 'الكاميرا',
      'voiceBtn': 'رد بصوت حقيقي',
      'liveDemo': 'تصميم تجريبي حي',
      'approveFull': 'عجبني - أنشئ التطبيق كامل',
      'phoneLabel': 'رقم الجوال',
      'sendActivation': 'أرسل كود التفعيل',
      'codePh': 'الكود 123456',
      'loginCode': 'دخول بالكود',
      'forgotSmart': 'نسيت كلمة السر؟ - فتح ذكي',
      'storyPh': 'قصة',
      'makeVideo2': 'اصنع لي الفيديو',
      'videoDone': 'تم صنع الفيديو',
      'emailLogin': 'دخول بالإيميل',
      'signedInAs': 'مسجل باسم',
      'quickQ': '3 أسئلة سريعة (اختياري)',
      'editDesign': 'عدّل التصميم',
      'home': 'الرئيسية',
      'builder': 'المنشئ',
      'video': 'فيديو',
      'settings': 'الإعدادات',
      'oneBoxHint': 'اكتب اللي تبيه… مثال: "أبي تطبيق لمحل ملابس"',
      'send': 'إرسال',
      'welcome': 'شنو تبي تسوي اليوم؟',
      'continueGoogle': 'المتابعة مع Google',
      'continueApple': 'المتابعة مع Apple',
      'continueFacebook': 'المتابعة مع Facebook',
      'continueGithub': 'المتابعة مع GitHub',
      'continuePhone': 'المتابعة برقم الهاتف',
      'continueEmail': 'المتابعة بالإيميل',
      'continueBiometric': 'الدخول ببصمة الوجه / الإصبع',
      'guest': 'جرّب بدون حساب',
      'forgot': 'نسيت كلمة المرور؟ استرجاع ذكي',
      'phone': 'رقم الهاتف (مع رمز الدولة)',
      'email': 'البريد الإلكتروني',
      'password': 'كلمة المرور',
      'name': 'الاسم',
      'sendCode': 'أرسل الرمز (SMS + واتساب + إيميل)',
      'code': 'الرمز من 6 أرقام',
      'verify': 'تحقق',
      'signIn': 'تسجيل الدخول',
      'signUp': 'إنشاء حساب',
      'recoveryTitle': 'ارجع لحسابك — اختر أسرع طريقة',
      'recBiometric': 'بصمة الوجه / الإصبع على هذا الجهاز',
      'recOtp': 'رمز على واتساب + SMS + إيميل بنفس الوقت',
      'recMagic': 'رابط سحري على إيميلي',
      'recDevice': 'موافقة من جهازي الثاني',
      'recQuestions': 'أجاوب على أسئلتي الذكية',
      'newPassword': 'كلمة المرور الجديدة',
      'savePassword': 'احفظ كلمة المرور',
      'passwordChanged': 'تم تغيير كلمة المرور. أهلاً فيك من جديد!',
      'waitingApproval': 'افتح التطبيق على جهازك الثاني ← الإعدادات ← الأجهزة ووافق.',
      'waitingMagic': 'أرسلنا لك رابط. افتحه من أي جهاز — وبندخلك هنا تلقائياً.',
      'identifier': 'الإيميل أو رقم الهاتف',
      'q1': 'شنو اسم المحل / التطبيق؟',
      'q2': 'شنو الألوان اللي تحبها؟',
      'q3': 'شنو تبيع أو تقدم؟',
      'next': 'التالي',
      'back': 'رجوع',
      'skip': 'تخطي',
      'livePreview': 'معاينة مباشرة',
      'edit': 'تعديل',
      'colors': 'الألوان',
      'font': 'الخط',
      'images': 'الصور',
      'sections': 'الأقسام',
      'products': 'المنتجات',
      'iLikeIt': 'عجبني — أنشئ التطبيق',
      'consentTitle': 'قبل ما ننشئ تطبيقك',
      'terms': 'أوافق على شروط الاستخدام',
      'privacy': 'أوافق على سياسة الخصوصية',
      'payment': 'أوافق على شروط الدفع',
      'connectTitle': 'اربط تطبيقك',
      'domain': 'الدومين (مثال myshop.com) — اختياري',
      'whatsapp': 'رقم الواتساب للطلبات',
      'instagram': 'اسم حساب انستغرام',
      'paymentConnect': 'اربط الدفع (Stripe / BenefitPay)',
      'publish': 'انشر الحين',
      'publishing': 'جاري نشر تطبيقك…',
      'published': 'تطبيقك صار شغال!',
      'openLink': 'افتح الرابط',
      'share': 'مشاركة',
      'copy': 'نسخ',
      'copied': 'تم النسخ',
      'storyHint': 'اكتب قصتك… ونحولها لفيديو كامل',
      'makeVideo': 'سوّ الفيديو',
      'duration': 'المدة',
      'short': '30–60 ثانية',
      'long': '1–3 دقائق',
      'videoReady': 'الفيديو جاهز',
      'download': 'تحميل',
      'camera': 'الكاميرا',
      'takePhoto': 'التقط صورة',
      'gallery': 'من الاستوديو',
      'buildFromPhoto': 'ابنِ تطبيق من الصورة',
      'translatePhoto': 'ترجم النص في الصورة',
      'scanQr': 'امسح QR / باركود',
      'scanDoc': 'امسح مستند',
      'idCard': 'عبّي التسجيل من البطاقة',
      'voice': 'الصوت',
      'voiceMale': 'رجل',
      'voiceFemale': 'امرأة',
      'voiceBahraini': 'بحريني',
      'speed': 'السرعة',
      'pitch': 'طبقة الصوت',
      'volume': 'مستوى الصوت',
      'testVoice': 'جرّب الصوت',
      'autoRead': 'قراءة الردود تلقائياً',
      'cloneVoice': 'استنسخ صوتي (30 ثانية)',
      'cloneConsent': 'هذا صوتي وأوافق على استنساخه',
      'record': 'تسجيل',
      'stop': 'إيقاف',
      'integrations': 'الربط',
      'connect': 'ربط',
      'disconnect': 'فصل',
      'connected': 'مربوط',
      'apiKeys': 'مفاتيحي الخاصة (BYOK)',
      'save': 'حفظ',
      'saved': 'تم الحفظ',
      'plans': 'الباقات',
      'free': 'مجاني',
      'pro': 'برو',
      'ultra': 'ألترا',
      'upgrade': 'ترقية',
      'currentPlan': 'باقتك الحالية',
      'devices': 'الأجهزة والموافقات',
      'approve': 'موافقة',
      'deny': 'رفض',
      'security': 'الأمان',
      'biometricLock': 'قفل البصمة / الوجه',
      'smartQuestions': 'أسئلة الاسترجاع الذكية',
      'signOut': 'تسجيل الخروج',
      'language': 'اللغة (تلقائي)',
      'languageHint': 'اكتب أو تكلم بأي لغة. قول "تكلم فرنسي" للتبديل.',
      'aiAuto': 'تلقائي',
      'aiChatgpt': 'ChatGPT',
      'aiClaude': 'Claude',
      'aiMeta': 'Meta AI',
      'aiGemini': 'Gemini',
      'aiChatgptDesc': 'الأفضل للكتابة',
      'aiClaudeDesc': 'الأفضل للبرمجة',
      'aiMetaDesc': 'مجاني وسريع',
      'aiGeminiDesc': 'الأفضل للصور والفيديو',
      'buildThis': 'ابنِ هذا التطبيق',
      'translate': 'ترجم',
      'listen': 'استمع',
      'slow': 'ياخذ وقت أكثر من العادة…',
      'alternatives': 'بالوقت نفسه تقدر:',
      'retry': 'حاول مرة ثانية',
      'useLocal': 'استخدم النسخة الفورية',
      'freeLimit': 'الباقة المجانية فيها 3 تطبيقات. رقّ لتطبيقات بلا حدود.',
      'paidFeature': 'هذي ميزة مدفوعة. رقّ عشان تفتحها.',
      'myApps': 'تطبيقاتي',
      'newApp': 'تطبيق جديد',
      'addProduct': 'أضف منتج',
      'price': 'السعر',
      'aiImage': 'صورة بالذكاء',
      'upload': 'رفع',
      'cart': 'السلة',
      'checkout': 'اطلب عبر واتساب',
      'booking': 'الحجز',
      'contact': 'تواصل',
      'search': 'بحث',
      'reviews': 'التقييمات',
      'admin': 'الإدارة',
      'map': 'الخريطة',
      'empty': 'ما في شي للحين',
      'profile': 'الملف الشخصي',
      'enterPhoto': 'وجّه الكاميرا على محل أو منيو أو بطاقة أو منتج',
      'result': 'النتيجة',
      'useInBuilder': 'افتح في المنشئ',
      'sentVia': 'تم إرسال الرمز عبر',
      'questionsSetup': 'حط 3 أسئلة محد يعرف جوابها غيرك',
      'answer': 'الجواب',
      'scenes': 'المشاهد',
      'storyboard': 'لوحة القصة',
      'play': 'تشغيل',
    },
  };
}
