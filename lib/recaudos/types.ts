export type RecaudoRow = {
  date: string;
  cityId: string | null;
  cityName: string;
  cediName: string;
  guideCount: number;
  amount: number;
  document: { id: string; fileName: string; uploadedAt: string } | null;
};
