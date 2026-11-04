import i18n, { locale } from "../i18n";

// Deo cene terena po igraču, zaokružen naviše na ceo dinar.
// Dok nema prijavljenih, deli se kao da je jedan igrač.
export const pricePerPlayer = (price, players) =>
  Math.ceil(price / Math.max(1, players));

// "1.200 din"
export const formatRSD = (amount) =>
  i18n.t("price.rsd", { value: Number(amount).toLocaleString(locale()) });

export const hasPrice = (match) =>
  match?.field_price !== null && match?.field_price !== undefined;
