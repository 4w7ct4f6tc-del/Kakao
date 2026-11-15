'use client';
import { useMemo, useState } from 'react';
import type { Design, Product } from '@/lib/design';
import Icon, { type IconName } from './Icon';

/** Interactive renderer for a JSON design — used in the builder preview AND the published app. */
export default function PreviewApp({ d, onChange, fullscreen = false }: { d: Design; onChange?: (d: Design) => void; fullscreen?: boolean }) {
  const ar = ['ar', 'fa', 'ur'].includes(d.language);
  const tr = (a: string, e: string) => (ar ? a : e);
  const [tab, setTab] = useState(0);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [day, setDay] = useState<number | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '', pay: '' });
  const c = d.colors;
  const money = (v: number) => `${Number.isInteger(v) ? v : v.toFixed(v < 10 ? 3 : 2)} ${d.currency}`;
  const wa = d.contact.whatsapp.replace(/[^0-9]/g, '');
  const total = useMemo(() => Object.entries(cart).reduce((s, [id, n]) => s + (d.products.find((p) => p.id === id)?.price || 0) * n, 0), [cart, d.products]);
  const add = (p: Product) => setCart((x) => ({ ...x, [p.id]: (x[p.id] || 0) + 1 }));
  const count = Object.values(cart).reduce((a, b) => a + b, 0);

  const Img = ({ p, h }: { p: { image?: string; emoji: string }; h: number }) =>
    p.image ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={p.image} alt="" className="w-full rounded-xl object-cover" style={{ height: h }} />
    ) : (
      <div className="flex w-full items-center justify-center rounded-xl" style={{ height: h, background: `linear-gradient(135deg, ${c.primary}2e, ${c.primary}60)`, fontSize: h * 0.42 }}>{p.emoji}</div>
    );

  const payMethods = [tr('الدفع عند الاستلام', 'Cash on delivery'), tr('بطاقة / Apple Pay', 'Card / Apple Pay'), 'BenefitPay'];
  const order = () => {
    const lines = Object.entries(cart).map(([id, n]) => { const p = d.products.find((x) => x.id === id)!; return `• ${p.name} x${n} = ${money(p.price * n)}`; }).join('\n');
    const info = [
      form.name && `${tr('الاسم', 'Name')}: ${form.name}`,
      form.phone && `${tr('الهاتف', 'Phone')}: ${form.phone}`,
      form.address && `${tr('العنوان', 'Address')}: ${form.address}`,
      `${tr('الدفع', 'Payment')}: ${form.pay || payMethods[0]}`,
      form.notes && `${tr('ملاحظات', 'Notes')}: ${form.notes}`,
    ].filter(Boolean).join('\n');
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`${tr('طلب جديد من', 'New order from')} ${d.name}\n${lines}\n${tr('المجموع', 'Total')}: ${money(total)}\n${info}`)}`, '_blank');
    setCart({});
    setCheckout(false);
  };

  const [admin, setAdmin] = useState(false);
  const [newP, setNewP] = useState({ name: '', price: '' });
  const adminAdd = () => {
    if (!newP.name.trim()) return;
    onChange?.({ ...d, products: [...d.products, { id: `a${Date.now()}`, name: newP.name.trim(), price: Number(newP.price) || 0, emoji: d.logoEmoji, category: d.categories[0] || '', image: '' }] });
    setNewP({ name: '', price: '' });
    setAdmin(false);
    setTab(1);
  };

  const Grid = ({ list }: { list: Product[] }) => (
    <div className="grid grid-cols-2 gap-2.5 px-3.5">
      {list.map((p) => (
        <div key={p.id} className="rounded-2xl bg-white p-2 shadow">
          <Img p={p} h={110} />
          <div className="mt-1.5 truncate text-[12px] font-bold text-black/85">{p.name}</div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold" style={{ color: c.primary }}>{money(p.price)}</span>
            <button onClick={() => add(p)} className="rounded-lg px-2 text-white" style={{ background: c.primary }}>+</button>
          </div>
        </div>
      ))}
    </div>
  );

  const Title = ({ s }: { s: string }) => <h3 className="px-3.5 pb-2 pt-4 text-[15px] font-extrabold">{s}</h3>;
  const Cta = ({ label, icon, onClick }: { label: string; icon: IconName; onClick: () => void }) => (
    <button onClick={onClick} className="mx-3.5 my-1 flex w-[calc(100%-28px)] items-center gap-2 rounded-2xl border p-3 text-start font-semibold" style={{ borderColor: `${c.primary}55` }}>
      <span style={{ color: c.primary }}><Icon name={icon} size={18} /></span>
      <span className="flex-1">{label}</span><span style={{ color: c.primary }}>{ar ? '‹' : '›'}</span>
    </button>
  );
  const reviews = ar ? [['سارة', 'خدمة ممتازة وتوصيل سريع'], ['محمد', 'الجودة رهيبة'], ['فاطمة', 'أنصح فيه بقوة']] : [['Sara', 'Great service and fast delivery'], ['Ali', 'Amazing quality'], ['Mona', 'Highly recommended']];
  const Reviews = () => (
    <div className="flex gap-2 overflow-x-auto px-3.5">
      {reviews.map(([n, r]) => <div key={n} className="min-w-[170px] rounded-2xl bg-white p-2.5 text-[11px] shadow"><b className="flex items-center gap-0.5 text-black/85"><span className="flex text-[#F59E0B]">{[0, 1, 2, 3, 4].map((k) => <Icon key={k} name="star" size={11} />)}</span> {n}</b><p className="text-black/55">{r}</p></div>)}
    </div>
  );
  const Map = () => (
    <a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(d.contact.address || d.name)}`} className="mx-3.5 flex h-[90px] items-center justify-center rounded-2xl" style={{ background: `${c.primary}14` }}>
      <Icon name="pin" size={18} className="me-1.5" />{d.contact.address || tr('افتح الخريطة', 'Open map')}
    </a>
  );
  const ContactBtns = () => (
    <div>
      <Cta icon="chat" label={`${tr('واتساب', 'WhatsApp')} ${d.contact.whatsapp}`} onClick={() => window.open(`https://wa.me/${wa}`, '_blank')} />
      <Cta icon="instagram" label={`@${d.contact.instagram.replace('@', '')}`} onClick={() => window.open(`https://instagram.com/${d.contact.instagram.replace('@', '')}`, '_blank')} />
      {d.contact.phone && <Cta icon="phone" label={d.contact.phone} onClick={() => (window.location.href = `tel:${d.contact.phone}`)} />}
    </div>
  );

  const home = d.sections.map((s) => {
    switch (s) {
      case 'hero':
        return (
          <div key={s} className="relative m-3.5">
            <Img p={{ image: d.heroImage, emoji: d.logoEmoji }} h={150} />
            <div className="absolute inset-0 flex flex-col justify-end rounded-xl bg-gradient-to-b from-transparent to-black/60 p-3.5">
              <b className="text-base text-white">{d.tagline}</b>
              <button onClick={() => setTab(1)} className="mt-1.5 w-fit rounded-full px-3 py-1 text-[11px] text-white" style={{ background: c.secondary }}>{tr('تسوق الآن', 'Shop now')}</button>
            </div>
          </div>
        );
      case 'categories':
        return <div key={s} className="flex gap-2 overflow-x-auto px-3.5">{d.categories.map((x) => <button key={x} onClick={() => { setCat(x); setTab(1); }} className="whitespace-nowrap rounded-full px-3.5 py-2 font-semibold" style={{ background: `${c.primary}14`, color: c.primary }}>{x}</button>)}</div>;
      case 'products':
        return <div key={s}><Title s={tr('الأكثر طلباً', 'Popular')} /><Grid list={d.products.slice(0, 4)} /></div>;
      case 'offers':
        return <div key={s} className="m-3.5 rounded-2xl p-3.5 font-bold text-white" style={{ background: c.secondary }}><span className="flex items-center gap-2"><Icon name="flame" size={18} />{tr('خصم 20% على أول طلب', '20% off your first order')}</span></div>;
      case 'booking':
        return <Cta key={s} icon="calendar" label={tr('احجز موعدك', 'Book an appointment')} onClick={() => setTab(3)} />;
      case 'reviews':
        return <div key={s}><Title s={tr('آراء العملاء', 'Reviews')} /><Reviews /></div>;
      case 'map':
        return <div key={s}><Title s={tr('موقعنا', 'Find us')} /><Map /></div>;
      case 'contact':
        return <div key={s} className="py-2"><ContactBtns /></div>;
      case 'about':
        return <div key={s}><Title s={tr('من نحن', 'About us')} /><p className="px-3.5">{d.name} — {tr('جودة وخدمة سريعة.', 'quality and fast service.')}</p></div>;
      default:
        return null;
    }
  });

  const filtered = d.products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase())));
  const days = Array.from({ length: 7 }, (_, i) => new Date(Date.now() + i * 864e5));

  const pages = [
    <div key="h" className="pb-5">{home}</div>,
    <div key="p" className="pb-5">
      <div className="p-3.5"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('ابحث…', 'Search…')} className="w-full rounded-2xl bg-black/5 px-3 py-2 text-[13px] text-black outline-none" /></div>
      <div className="mb-2.5 flex gap-1.5 overflow-x-auto px-3.5">
        {[null, ...d.categories].map((x) => <button key={x || 'all'} onClick={() => setCat(x)} className="whitespace-nowrap rounded-full border px-3 py-1 text-[11px]" style={cat === x ? { background: c.primary, color: '#fff', borderColor: c.primary } : { borderColor: '#0002' }}>{x || tr('الكل', 'All')}</button>)}
      </div>
      <Grid list={filtered} />
    </div>,
    <div key="c" className="flex h-full flex-col">
      {count === 0 ? <div className="m-auto text-center"><div className="mb-2 flex justify-center opacity-40"><Icon name="cart" size={44} /></div>{tr('السلة فاضية', 'Your cart is empty')}</div> : (
        <>
          <div className="flex-1 space-y-2 overflow-auto p-3.5">
            {Object.entries(cart).map(([id, n]) => { const p = d.products.find((x) => x.id === id)!; return (
              <div key={id} className="flex items-center gap-2">
                <div className="w-11"><Img p={p} h={44} /></div>
                <div className="flex-1 text-[13px]">{p.name}<div className="text-[12px]" style={{ color: c.primary }}>{money(p.price * n)}</div></div>
                <button onClick={() => setCart((x) => { const y = { ...x }; if (n <= 1) delete y[id]; else y[id] = n - 1; return y; })} aria-label="minus"><Icon name="minus" size={16} /></button>{n}<button onClick={() => add(p)} aria-label="plus"><Icon name="plus" size={16} /></button>
              </div>); })}
          </div>
          <div className="p-3.5">
            <div className="flex justify-between font-bold"><span>{tr('المجموع', 'Total')}</span><span style={{ color: c.primary }}>{money(total)}</span></div>
            {!checkout ? (
              <button onClick={() => setCheckout(true)} className="mt-2 w-full rounded-xl py-2.5 font-bold text-white" style={{ background: c.primary }}><span className="flex items-center justify-center gap-2"><Icon name="receipt" size={18} />{tr('إتمام الطلب', 'Checkout')}</span></button>
            ) : (
              <div className="mt-2 space-y-1.5">
                {(['name', 'phone', 'address', 'notes'] as const).map((k) => (
                  <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder={{ name: tr('الاسم', 'Name'), phone: tr('الهاتف', 'Phone'), address: tr('العنوان', 'Address'), notes: tr('ملاحظات', 'Notes') }[k]} className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] text-black outline-none" />
                ))}
                <div className="flex flex-wrap gap-1">
                  {payMethods.map((m) => <button key={m} onClick={() => setForm({ ...form, pay: m })} className="rounded-full border px-2 py-0.5 text-[10px]" style={(form.pay || payMethods[0]) === m ? { background: c.primary, color: '#fff' } : {}}>{m}</button>)}
                </div>
                <button onClick={order} className="w-full rounded-xl bg-[#25D366] py-2.5 font-bold text-white"><span className="flex items-center justify-center gap-2"><Icon name="chat" size={18} />{tr('أرسل الطلب عبر واتساب', 'Send order on WhatsApp')}</span></button>
              </div>
            )}
          </div>
        </>
      )}
    </div>,
    <div key="b" className="p-3.5">
      <b>{tr('اختر اليوم', 'Pick a day')}</b>
      <div className="my-2 flex gap-1.5 overflow-x-auto">{days.map((x, i) => <button key={i} onClick={() => setDay(i)} className="min-w-[48px] rounded-xl py-3 text-[11px] font-bold" style={day === i ? { background: c.primary, color: '#fff' } : { background: `${c.primary}14`, color: c.primary }}>{x.getDate()}/{x.getMonth() + 1}</button>)}</div>
      <b>{tr('اختر الوقت', 'Pick a time')}</b>
      <div className="my-2 flex flex-wrap gap-1.5">{['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'].map((s) => <button key={s} onClick={() => setSlot(s)} className="rounded-full border px-3 py-1 text-[11px]" style={slot === s ? { background: c.primary, color: '#fff' } : {}}>{s}</button>)}</div>
      <button disabled={day === null || !slot} onClick={() => window.open(`https://wa.me/${wa}?text=${encodeURIComponent(`${tr('حجز موعد', 'Booking')}: ${days[day!].getDate()}/${days[day!].getMonth() + 1} ${slot} — ${d.name}`)}`, '_blank')} className="mt-3 w-full rounded-xl py-2.5 font-bold text-white disabled:opacity-40" style={{ background: c.primary }}>{tr('أكّد الحجز', 'Confirm booking')}</button>
    </div>,
    <div key="ct" className="space-y-3 py-3.5"><ContactBtns /><Map /><Reviews /></div>,
  ];

  // Home | Products | Cart | Contact (booking opens from Home).
  const nav: [IconName, string, number][] = [['home', tr('الرئيسية', 'Home'), 0], ['shirt', tr('المنتجات', 'Products'), 1], ['cart', tr('السلة', 'Cart'), 2], ['phone', tr('تواصل', 'Contact'), 4]];

  return (
    <div dir={ar ? 'rtl' : 'ltr'} className={`flex flex-col text-[13px] ${fullscreen ? 'min-h-screen' : 'h-full'}`} style={{ background: c.background, color: c.text, fontFamily: `${d.font}, Cairo, Inter, sans-serif` }}>
      <div className={`flex items-center gap-2 px-3.5 pb-2.5 ${fullscreen ? 'pt-4' : 'pt-10'}`} style={{ background: c.primary }}>
        <span className="text-xl">{d.logoEmoji}</span>
        <b className="flex-1 truncate text-base text-white">{d.name}</b>
        {onChange && <button onClick={() => setAdmin(!admin)} title={tr('لوحة الإدارة', 'Admin Panel')} className="text-white"><Icon name="wrench" size={18} /></button>}
        <button onClick={() => setTab(2)} className="relative text-white" aria-label="cart"><Icon name="bag" size={18} />{count > 0 && <span className="absolute -end-2 -top-1 rounded-full bg-red-600 px-1 text-[9px]">{count}</span>}</button>
      </div>
      {admin && (
        <div className="space-y-1.5 bg-white p-3 text-black shadow">
          <b className="text-[13px]">{tr('لوحة الإدارة — منتج جديد', 'Admin Panel — new product')}</b>
          <input value={newP.name} onChange={(e) => setNewP({ ...newP, name: e.target.value })} placeholder={tr('الاسم', 'Name')} className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] outline-none" />
          <input value={newP.price} onChange={(e) => setNewP({ ...newP, price: e.target.value })} inputMode="decimal" placeholder={tr('السعر', 'Price')} className="w-full rounded-lg bg-black/5 px-2.5 py-1.5 text-[12px] outline-none" />
          <div className="flex gap-1.5">
            <button onClick={adminAdd} className="flex-1 rounded-lg py-1.5 text-[12px] font-bold text-white" style={{ background: c.primary }}>{tr('إضافة', 'Add')}</button>
            <button onClick={() => setAdmin(false)} className="rounded-lg border px-3 text-[12px]">{tr('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto">{pages[tab]}</div>
      <div className="flex bg-white pb-2.5 pt-1.5">
        {nav.map(([i, l, idx]) => <button key={idx} onClick={() => setTab(idx)} className="flex flex-1 flex-col items-center text-[10px] font-semibold" style={{ color: tab === idx ? c.primary : '#0008' }}><Icon name={i} size={18} />{l}</button>)}
      </div>
    </div>
  );
}

/** Phone frame with a black border (owner's design). */
export function PhoneFrame({ children, width = 290 }: { children: React.ReactNode; width?: number }) {
  return (
    <div className="relative mx-auto rounded-[40px] border-[10px] border-black bg-black shadow-xl" style={{ width, height: width * 2 }}>
      <div className="h-full overflow-hidden rounded-[30px] bg-white">{children}</div>
      <div className="absolute left-1/2 top-1.5 h-5 w-[86px] -translate-x-1/2 rounded-full bg-black" />
    </div>
  );
}
