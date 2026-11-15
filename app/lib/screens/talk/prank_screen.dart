import 'dart:async';
import 'dart:math';

import 'package:material_ui/material_ui.dart';

/// Joke only: falling green "hacker" codes with "دورني", then 5 seconds of black,
/// then it closes by itself. Nothing on the device is touched — it is just an animation.
class PrankScreen extends StatefulWidget {
  const PrankScreen({super.key});

  static Future<void> show(BuildContext context) => Navigator.of(context).push(PageRouteBuilder(
        opaque: true,
        pageBuilder: (_, _, _) => const PrankScreen(),
        transitionDuration: Duration.zero,
      ));

  @override
  State<PrankScreen> createState() => _PrankScreenState();
}

class _PrankScreenState extends State<PrankScreen> with SingleTickerProviderStateMixin {
  late final AnimationController _tick = AnimationController(vsync: this, duration: const Duration(seconds: 1))..repeat();
  final _rain = _Rain();
  bool black = false;
  Timer? _t1, _t2;

  @override
  void initState() {
    super.initState();
    _t1 = Timer(const Duration(milliseconds: 3500), () => setState(() => black = true));
    _t2 = Timer(const Duration(milliseconds: 8500), () {
      if (mounted) Navigator.of(context).pop();
    });
  }

  @override
  void dispose() {
    _t1?.cancel();
    _t2?.cancel();
    _tick.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: Colors.black,
        body: black
            ? const SizedBox.expand()
            : Stack(children: [
                Positioned.fill(child: AnimatedBuilder(animation: _tick, builder: (_, _) => CustomPaint(painter: _RainPainter(_rain)))),
                const Center(
                  child: Text('دورني',
                      style: TextStyle(color: Color(0xFF16FF5A), fontSize: 64, fontWeight: FontWeight.w900, shadows: [Shadow(color: Color(0xFF16FF5A), blurRadius: 24)])),
                ),
              ]),
      ),
    );
  }
}

class _Rain {
  final rnd = Random();
  final drops = <double>[];
  static const chars = '01アイウエオカキクケコابتثجحخدذرزسشصضطظعغفقكلمنهوي#\$%&';
  String char() => chars[rnd.nextInt(chars.length)];
}

class _RainPainter extends CustomPainter {
  final _Rain r;
  _RainPainter(this.r);

  @override
  void paint(Canvas canvas, Size size) {
    const cell = 18.0;
    final cols = (size.width / cell).ceil();
    while (r.drops.length < cols) {
      r.drops.add(-r.rnd.nextDouble() * 40);
    }
    for (var i = 0; i < cols; i++) {
      for (var k = 0; k < 14; k++) {
        final y = (r.drops[i] - k) * cell;
        if (y < 0 || y > size.height) continue;
        final tp = TextPainter(
          text: TextSpan(text: r.char(), style: TextStyle(color: const Color(0xFF16FF5A).withValues(alpha: k == 0 ? 1 : (1 - k / 14) * 0.7), fontSize: 16, fontFamily: 'monospace')),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(i * cell, y));
      }
      r.drops[i] = r.drops[i] * cell > size.height + 200 && r.rnd.nextDouble() > 0.95 ? 0 : r.drops[i] + 0.6;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
