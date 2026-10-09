import algeriaData from './algeria.json';

export interface Commune {
  name_fr: string;
  name_ar: string;
  daira: string;
  postal_code: string;
}

export interface Wilaya {
  code: number;
  name_fr: string;
  name_ar: string;
  communes: Commune[];
}

const data = algeriaData as Wilaya[];

export class AlgeriaCities {
  static getWilayas() {
    return data.map(w => ({
      code: w.code,
      name_fr: w.name_fr,
      name_ar: w.name_ar,
      label: `${w.code.toString().padStart(2, '0')} - ${w.name_fr}`
    }));
  }

  static getCommunes(wilayaCode: number) {
    const wilaya = data.find(w => w.code === wilayaCode);
    if (!wilaya) return [];
    return wilaya.communes.map(c => c.name_fr).sort();
  }

  static getDairas(wilayaCode: number) {
    const wilaya = data.find(w => w.code === wilayaCode);
    if (!wilaya) return [];
    // Get unique dairas
    const dairas = Array.from(new Set(wilaya.communes.map(c => c.daira)));
    return dairas.sort();
  }
}
