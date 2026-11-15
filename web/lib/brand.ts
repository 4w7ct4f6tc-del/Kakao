export const Brand = {
  nameAr: 'خعخعو',
  nameEn: 'KAkAo',
  company: 'B.K.A Famy',
  companyFull: 'K.A Familia Global Company',
  owner: 'alansari',
  name: (lang: string) => (lang === 'ar' ? 'خعخعو' : 'KAkAo'),
  letter: (lang: string) => (lang === 'ar' ? 'خ' : 'K'),
  footer: (lang: string) => `${lang === 'ar' ? 'خعخعو' : 'KAkAo'} • © 2026 K.A Familia Global Company`,
};

export const RTL = ['ar', 'fa', 'ur', 'he'];
