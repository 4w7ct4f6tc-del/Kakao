import 'dart:convert';

import '../core/api.dart';
import '../state/providers.dart' show prefs;

/// Same lists as functions/persona.js — (id, Arabic, English).
const girlDialects = [
  ('bahraini_riffa', 'بحريني رفاعي', 'Bahraini Riffa'), ('bahraini', 'بحريني', 'Bahraini'), ('saudi_najdi', 'سعودي نجدي', 'Saudi Najdi'), ('saudi_hijazi', 'سعودي حجازي', 'Saudi Hijazi'),
  ('emirati', 'إماراتي', 'Emirati'), ('kuwaiti', 'كويتي', 'Kuwaiti'), ('qatari', 'قطري', 'Qatari'), ('omani', 'عماني', 'Omani'),
  ('egyptian', 'مصري', 'Egyptian'), ('moroccan', 'مغربي', 'Moroccan'), ('algerian', 'جزائري', 'Algerian'), ('tunisian', 'تونسي', 'Tunisian'),
  ('jordanian', 'أردني', 'Jordanian'), ('palestinian', 'فلسطيني', 'Palestinian'), ('lebanese', 'لبناني', 'Lebanese'), ('syrian', 'سوري', 'Syrian'),
  ('iraqi', 'عراقي', 'Iraqi'), ('yemeni', 'يمني', 'Yemeni'), ('sudanese', 'سوداني', 'Sudanese'),
];
const girlStyles = [
  ('soft', 'ناعمة', 'Soft'), ('formal', 'رسمية', 'Formal'), ('happy', 'تضحك', 'Happy'), ('story', 'قصص', 'Storytelling'),
  ('ad', 'إعلانات', 'Advertising'), ('kids', 'أطفال', 'Kids'), ('friendly', 'صديقة', 'Friendly'),
];
const girlModes = [('chat', 'محادثة', 'Chat'), ('story', 'قصة', 'Story'), ('ad', 'إعلان', 'Ad')];
const girlSpeeds = [('slow', 'بطيء', 'Slow'), ('normal', 'عادي', 'Normal'), ('fast', 'سريع', 'Fast')];

class GirlSettings {
  final String dialect, style, mode, speed;
  final bool lisp; // light Riffa lisp in دانو's voice (ر → و in speech only)
  const GirlSettings({this.dialect = 'bahraini_riffa', this.style = 'friendly', this.mode = 'chat', this.speed = 'normal', this.lisp = true});

  GirlSettings copyWith({String? dialect, String? style, String? mode, String? speed, bool? lisp}) => GirlSettings(
      dialect: dialect ?? this.dialect, style: style ?? this.style, mode: mode ?? this.mode, speed: speed ?? this.speed, lisp: lisp ?? this.lisp);

  Map<String, dynamic> toJson() => {'dialect': dialect, 'style': style, 'mode': mode, 'speed': speed, 'lisp': lisp};
  factory GirlSettings.fromJson(Map<String, dynamic> j) => GirlSettings(
        dialect: (j['dialect'] ?? 'bahraini_riffa').toString(),
        style: (j['style'] ?? 'friendly').toString(),
        mode: (j['mode'] ?? 'chat').toString(),
        speed: (j['speed'] ?? 'normal').toString(),
        lisp: j['lisp'] != false,
      );

  @override
  bool operator ==(Object other) => other is GirlSettings && other.toJson().toString() == toJson().toString();
  @override
  int get hashCode => toJson().toString().hashCode;

  static GirlSettings load() {
    try {
      final s = prefs.getString('girl');
      return s == null ? const GirlSettings() : GirlSettings.fromJson(jsonDecode(s));
    } catch (_) {
      return const GirlSettings();
    }
  }

  Future<void> save() => prefs.setString('girl', jsonEncode(toJson()));
}

class TalkReply {
  final String text;
  final String? audio;
  final String? action; // insult | prank
  final String? comebackText;
  final String? comebackAudio;
  final String? build;
  final String? video;
  final GirlSettings settings;
  final bool offline;
  TalkReply({required this.text, this.audio, this.action, this.comebackText, this.comebackAudio, this.build, this.video, required this.settings, this.offline = false});
}

/// "بنت خعخعو" — the girl voice conversation.
class GirlService {
  static const _keys = {
    'saudi_hijazi': ['حجازي', 'جدة'], 'bahraini_riffa': ['رفاعي', 'الرفاع'], 'bahraini': ['بحريني', 'البحرين'], 'saudi_najdi': ['نجدي', 'سعودي'], 'emirati': ['إماراتي', 'اماراتي'],
    'kuwaiti': ['كويتي'], 'qatari': ['قطري'], 'omani': ['عماني'], 'egyptian': ['مصري', 'المصرية'], 'moroccan': ['مغربي'], 'algerian': ['جزائري'],
    'tunisian': ['تونسي'], 'jordanian': ['أردني', 'اردني'], 'palestinian': ['فلسطيني'], 'lebanese': ['لبناني'], 'syrian': ['سوري'],
    'iraqi': ['عراقي'], 'yemeni': ['يمني'], 'sudanese': ['سوداني'],
  };
  static const _styleKeys = {'soft': ['ناعمة'], 'formal': ['رسمية'], 'happy': ['تضحك', 'ضحك'], 'story': ['قصص'], 'ad': ['إعلانات'], 'kids': ['أطفال', 'اطفال'], 'friendly': ['صديقة']};

  /// "سوي لي إعلان لمحلي باللهجة المصرية بنت تضحك" → egyptian / happy / ad.
  static GirlSettings applyRequest(GirlSettings s, String text) {
    final t = text.toLowerCase();
    var out = s;
    for (final e in _keys.entries) {
      if (e.value.any(t.contains)) {
        out = out.copyWith(dialect: e.key);
        break;
      }
    }
    for (final e in _styleKeys.entries) {
      if (e.value.any(t.contains)) {
        out = out.copyWith(style: e.key);
        break;
      }
    }
    if (RegExp(r'(سوي|اكتب|ابي|أبي|ابغى).{0,20}(إعلان|اعلان)').hasMatch(t)) {
      out = out.copyWith(mode: 'ad');
    } else if (RegExp(r'(سوي|احكي|اكتب|ابي|أبي|ابغى).{0,20}(قصة|قصه|حكاية)').hasMatch(t)) {
      out = out.copyWith(mode: 'story');
    }
    return out;
  }

  static Future<TalkReply> talk(String event, GirlSettings s, List<Map<String, String>> history, int strikes, {String engine = 'claude'}) async {
    try {
      final r = await Api.post('/talk', {'event': event, ...s.toJson(), 'messages': history, 'strikes': strikes, 'engine': engine},
          retries: 0, timeout: const Duration(seconds: 60));
      return TalkReply(
        text: (r['text'] ?? '').toString(),
        audio: r['audio'] as String?,
        action: r['action'] as String?,
        comebackText: r['comebackText'] as String?,
        comebackAudio: r['comebackAudio'] as String?,
        build: r['build'] as String?,
        video: r['video'] as String?,
        settings: r['settings'] is Map ? GirlSettings.fromJson(Map<String, dynamic>.from(r['settings'])) : s,
      );
    } catch (_) {
      final last = history.lastWhere((m) => m['role'] == 'user', orElse: () => const {'content': ''})['content'] ?? '';
      return _offline(event, applyRequest(s, last), last, strikes);
    }
  }

  static const _greet = {
    'bahraini_riffa': 'هلا هلا! أنا هني، شنو عندك اليوم؟ قول بسرعة قبل لا أمل.',
    'bahraini': 'هلا والله يالحلو! أنا بنت خعخعو. شنو مسوي اليوم؟ ولا تقول لي ما سويت شي!',
    'saudi_najdi': 'هلا والله! أنا بنت خعخعو. وش عندك اليوم؟ لا تقول لي مافي شي ترى أعرفك!',
    'saudi_hijazi': 'أهلين! أنا بنت خعخعو. إيش عندك اليوم؟ قول بسرعة قبل ما أزعل!',
    'emirati': 'هلا والله! شحالك؟ أنا بنت خعخعو. شو عندك اليوم؟',
    'kuwaiti': 'هلا والله! شلونك؟ أنا بنت خعخعو. شنو عندك اليوم؟ لا تخبي علي!',
    'qatari': 'هلا والله! شلونك؟ أنا بنت خعخعو. شنو مسوي اليوم؟',
    'omani': 'حيّاك! كيف حالك؟ أنا بنت خعخعو. شو عندك اليوم؟',
    'egyptian': 'أهلاً بيك! إزيك عامل إيه؟ أنا بنت خعخعو. عندك فكرة إيه النهارده؟',
    'moroccan': 'مرحبا بيك! كيداير؟ أنا بنت خعخعو. شنو عندك اليوم؟',
    'algerian': 'مرحبا! واش راك؟ أنا بنت خعخعو. واش عندك اليوم؟',
    'tunisian': 'عسلامة! لاباس؟ أنا بنت خعخعو. شنوة عندك اليوم؟',
    'jordanian': 'هلا والله! كيفك؟ أنا بنت خعخعو. شو عندك اليوم؟',
    'palestinian': 'أهلين! كيفك؟ أنا بنت خعخعو. شو في عندك اليوم؟',
    'lebanese': 'هلا حبيبي! كيفك؟ أنا بنت خعخعو. شو عندك اليوم؟ يلا خبرني!',
    'syrian': 'أهلين! كيفك؟ أنا بنت خعخعو. شو عندك اليوم؟',
    'iraqi': 'هلا عيوني! شلونك؟ أنا بنت خعخعو. شكو ماكو اليوم؟',
    'yemeni': 'أهلاً وسهلاً! كيف حالك؟ أنا بنت خعخعو. ايش عندك اليوم؟',
    'sudanese': 'أهلاً! كيفنك؟ أنا بنت خعخعو. عندك شنو الليلة؟',
  };
  static final _rude = RegExp(r'(غبي|غبية|حمار|حمارة|تافه|اسكتي|انقلعي|كلب|stupid|idiot|shut up|dumb)', caseSensitive: false);

  /// Offline preview so the flow is visible without keys.
  static TalkReply _offline(String event, GirlSettings s, String last, int strikes) {
    TalkReply r(String text, {String? action, String? comeback, String? build, String? video}) =>
        TalkReply(text: text, action: action, comebackText: comeback, build: build, video: video, settings: s, offline: true);
    if (event == 'start' || last.isEmpty) return r(_greet[s.dialect] ?? _greet['bahraini']!);
    if (event == 'nudge') return r('وينك؟ سكت؟ زعلت؟ ترى أنا أمزح وياك!');
    if (_rude.hasMatch(last)) {
      if (strikes == 0) return r('هاي المرة بمشيها، مرة ثانية انتبه لكلامك يالحلو.', action: 'insult');
      return r('إذا انت تغلط، أنا أعلمك شلون أفرمت تلفون!', action: 'prank', comeback: 'تعال أتغشمر بس، خلك محترم يالحلو.');
    }
    if (RegExp(r'(ذكاء اصطناعي|روبوت|robot)', caseSensitive: false).hasMatch(last)) {
      return r('إيه ذكاء اصطناعي، بس بدم خفيف أكثر منك! لا تناديني روبوت، أنا بنت خعخعو.');
    }
    if (RegExp(r'(تطبيق|app|موقع|متجر)', caseSensitive: false).hasMatch(last)) {
      return r('أوك أوك، بسويه لك! بس قبلها، ليش تأخرت علي اليوم؟ كنت أنطرك!', build: last);
    }
    if (RegExp(r'(فيديو|video)', caseSensitive: false).hasMatch(last)) return r('بسوي لك، بس إذا طلع حلو، بتعزمني على كرك؟', video: last);
    if (RegExp(r'(ما فهمت|مافهمت)').hasMatch(last)) {
      return r('أدري ما فهمت، لأنك كنت تفكر في شي ثاني، صح؟ عادي، كلنا ما نفهم أول مرة. تعال أشرح لك من جديد وبكل هدوء.');
    }
    return r('حلو كلامك! بس هذي معاينة، أول ما نربط مفاتيح الذكاء الاصطناعي بسولف معاك صدق صدق.');
  }
}

// ================================================================ نقاش ثلاثي: AI 1 + دانو
class DanuReply {
  final String text;
  final String? audio, action, comebackText, comebackAudio, build, video, summary;
  final bool family, hangup;
  DanuReply({required this.text, this.audio, this.action, this.comebackText, this.comebackAudio, this.build, this.video, this.summary, this.family = false, this.hangup = false});

  factory DanuReply.fromJson(Map<String, dynamic> j) => DanuReply(
        text: (j['text'] ?? '').toString(),
        audio: j['audio'] as String?,
        action: j['action'] as String?,
        comebackText: j['comebackText'] as String?,
        comebackAudio: j['comebackAudio'] as String?,
        build: j['build'] as String?,
        video: j['video'] as String?,
        summary: j['summary'] as String?,
        family: j['family'] == true,
        hangup: j['hangup'] == true,
      );
}

class DiscussReply {
  final String? ai1;
  final DanuReply? danu;
  DiscussReply(this.ai1, this.danu);
}

class DiscussState {
  int strikes = 0, familyAsks = 0, turns = 0;
  bool loud = false;
  Map<String, dynamic> toJson() => {'strikes': strikes, 'familyAsks': familyAsks, 'turns': turns, 'loud': loud};
}

/// AI 1 (chat) + دانو (on a call). roles: user | ai1 | danu
class DiscussService {
  static Future<DiscussReply> send(String event, bool call, GirlSettings s, List<Map<String, String>> history, DiscussState st, {String engine = 'claude'}) async {
    try {
      final r = await Api.post('/discuss', {'event': event, 'call': call, ...s.toJson(), 'messages': history, ...st.toJson(), 'engine': engine},
          retries: 0, timeout: const Duration(seconds: 90));
      return DiscussReply(
        (r['ai1'] as Map?)?['text']?.toString(),
        r['danu'] is Map ? DanuReply.fromJson(Map<String, dynamic>.from(r['danu'])) : null,
      );
    } catch (_) {
      final ai1 = event == 'reply' ? _offlineAi1(history) : null;
      final withAi1 = [...history, if (ai1 != null) {'role': 'ai1', 'content': ai1}];
      return DiscussReply(ai1, call ? _offlineDanu(event, withAi1, st) : null);
    }
  }

  static String _offlineAi1(List<Map<String, String>> h) {
    final last = h.lastWhere((m) => m['role'] == 'user', orElse: () => const {'content': ''})['content'] ?? '';
    final short = last.length > 60 ? last.substring(0, 60) : last;
    return 'فهمت فكرتك: "$short". الفكرة زينة، وأقترح نبدأ بأبسط نسخة منها ونجربها بسرعة.\nاقتراح مني: نسوي معاينة في المصنع خلال دقيقة.\nاقتراح منك: شنو أهم شي تبيه يكون فيها؟';
  }

  static final _family = RegExp(r'(أمج|امج|أمك|امك|أبوج|ابوج|أبوك|ابوك|أهلج|اهلج|طلاق|تطلقوا|والدتج|والدج)');

  static DanuReply _offlineDanu(String event, List<Map<String, String>> h, DiscussState st) {
    final last = h.lastWhere((m) => m['role'] == 'user', orElse: () => const {'content': ''})['content'] ?? '';
    DanuReply r(String t, {String? action, String? comeback, bool family = false, bool hangup = false, String? summary}) =>
        DanuReply(text: t, action: action, comebackText: comeback, family: family, hangup: hangup, summary: summary);
    if (event == 'join') return r('هلا هلا! منو متصل؟ أنا دانو من الرفاع. شفت فكرتكم… خلوني أصلحها لكم، صيدني يالحلو.');
    if (event == 'nudge') return r('وينك؟ سكت؟ زعلت؟ ترى أنا أمزح وياك!');
    if (GirlService._rude.hasMatch(last)) {
      if (st.strikes == 0) return r('هاي المرة بمشيها، مرة ثانية لا تقولي ذكاء اصطناعي.', action: 'insult');
      return r('إذا انت تغلط، أنا أعلمك شلون أفرمت تلفون!', action: 'prank', comeback: 'تعال أتغشمر بس، خلك محترم يالحلو.');
    }
    if (_family.hasMatch(last)) {
      if (st.familyAsks == 0) return r('أتفشل أقول، بس باختصار أمي صادت أبوي مع الخدامة. خلنا في فكرتك أحسن.', family: true);
      if (st.familyAsks == 1) return r('بمشي.', family: true);
      return r('قلت لك بمشي، باي.', hangup: true, summary: 'اتفقنا نكمل فكرتك بعدين، والموضوع هذا مسكر.');
    }
    if (last.contains('وين حرف الراء')) return r('عصوم شاله يبي يعاقبني، قالي بوجعه إذا جفت شاطرة.');
    if (last.contains('وين في الرفاع')) return r('تبي أعطيك رقم أبوي بعد؟ ركز في اللي انت فيه، أي هاي اللي ناقص بعد.');
    if (RegExp(r'وين بيتج|وين ساكنة|وين تسكنين|من وين انتي').hasMatch(last)) return r('مالت الرفاع وبحرانيه ويش تمبي خوك');
    if (RegExp(r'^\s*(لا|لاء)\s*$').hasMatch(last) && h.any((m) => m['role'] == 'danu' && (m['content'] ?? '').contains('وين بيتنا'))) {
      return r('أي الحين صرت شطور، تعلمت من الدرس حبيبي، كل يوم تعال خذلك درس لين تتعلم إني رفاعية مالعب، بس فعل.');
    }
    if (RegExp(r'(ما فهمت|مافهمت)').hasMatch(last)) return r('عادي، كلنا ما نفهم أول مرة. تعال أخفف عليك الموضوع، أنا معاك، أنا أحتويك.');
    if (st.loud) return r('هي هي، تكلم بالعدال! … أي هالون شاطر، كمل كمل.');
    if (st.turns >= 3 && st.turns % 4 == 3) return r('مللتوني، أنا سلي خلاني أتعرف على إنسان وذكاء اصطناعي، معلوماتكم قديمة.');
    if (st.turns == 2) return r('المساعد قال كلام حلو، بس أنا عندي أذكى منه: خله بسيط وبسرعة. تعال صج تبي أقولك وين بيتنا؟');
    return r('فكرة حلوة، بس عدلها شوي: ابدأ بشي صغير وجربه، وبعدين كبّره. ضبطني أضبطك!');
  }
}
