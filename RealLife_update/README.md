# RealLife

لعبة حياة واقعية بعالم مفتوح، مشروع Unity 6 (6000.6.9f1) بقالب URP ثلاثي الأبعاد.

- فكرة اللعبة والمراحل: [GAME_IDEA.md](GAME_IDEA.md)
- حالة الشغل ووين وقفنا: [PROGRESS.md](PROGRESS.md)

## التشغيل
1. فعّل رخصة Unity Personal المجانية من Unity Hub: Preferences ← Licenses ← Add ← Get a free personal license.
2. من Unity Hub: Projects ← Add ← Add project from disk، واختر مجلد `RealLife`.
3. افتح المشهد `Assets/Scenes/NYC.unity` (المدينة الأساسية)، واضغط Play.
   - المشهد القديم `Assets/Scenes/City.unity` (مدينة مولّدة بالكود) لسا موجود.

## التحكم
**على رجولك:**
- WASD أو الأسهم: المشي
- Shift: الركض
- Space: النط
- **F**: تركب السيارة إذا كنت قريب منها
- **E**: تشتري من المحل إذا كنت واقف عنده
- **E** عند كشك الوظيفة (مركز الشرطة أو مستودع التوصيل): **1** تقديم أو بدء دوام، **2** استقالة

**في السيارة:**
- W / S: بنزين وفرامل (S وأنت واقف: رجوع)
- A / D: لف
- Space: فرامل يد
- **F**: تنزل

**عام:**
- الماوس: تدوير الكاميرا، والعجلة للتقريب
- Esc: يطلّع المؤشر، والكلك يقفله مرة ثانية
- H: يخفي شاشة المساعدة

## الحزم المستخدمة (Asset Store، مجانية)
- NYC Block #6: المدينة (`Assets/OutPost`)
- Vehicle Physics Pro - Community Edition: فيزياء السيارة (`Assets/Vehicle Physics Pro`). النسخة المجانية تسمح بسيارة وحدة في المشهد.
- Demo City By Versatile Studio: مستوردة وما استخدمناها للحين (`Assets/Versatile Studio Assets`)

## السكربتات
- `Assets/Scripts/PlayerController.cs`: حركة الشخصية بـ CharacterController
- `Assets/Scripts/ThirdPersonCamera.cs`: كاميرا من ورا الشخصية، فيها تنعيم وتمنع الكاميرا تدخل في الجدران
- `Assets/Scripts/VehicleInteraction.cs`: ركوب ونزول من السيارة بالزر F
- `Assets/Scripts/VppParkedBrake.cs`: يشغّل محرك السيارة لما تركب، ويوقفها ويطفيها لما تنزل
- `Assets/Scripts/CityBuilder.cs`: يولّد المدينة القديمة، وفيه دوال إنشاء الشخصية والكاميرا
- `Assets/Scripts/TrafficSystem.cs`: المرحلة 4، يلقى البلوك بروحه ويوزّع المشاة وسيارات المرور حوله (ينضاف بروحه وقت Play)
- `Assets/Scripts/Pedestrian.cs` و `TrafficCar.cs` و `LoopPath.cs` و `AgentParts.cs`: المشاة وسيارات المرور ومساراتهم
- `Assets/Scripts/Jobs.cs` و `JobSystem.cs` و `JobOffice.cs`: المرحلة 5، الوظايف (الشرطة والتوصيل)
- `Assets/Editor/`: أدوات المحرر. قائمة **RealLife** فيها: Build NYC Scene، Convert Materials To URP، Rebuild City
