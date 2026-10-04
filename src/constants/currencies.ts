// Single source of truth for every currency selectable anywhere in the app (onboarding, settings,
// new trip, trip detail, home). Previously this list was independently copy-pasted in three
// different files and had drifted out of sync (different currencies, different symbols) — keep it
// here and import from this file everywhere instead of redefining it.
//
// Actual conversion rates are never hardcoded — src/utils/currency.ts fetches live exchange rates
// for any ISO 4217 code from a free rates API, so a currency just needs to be listed here (with
// its real ISO code) to be both selectable and correctly converted.
export const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'KRW', symbol: '₩', name: 'Korean Won' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  // -- Latin America --
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso' },
  { code: 'COP', symbol: 'CO$', name: 'Colombian Peso' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol' },
  { code: 'UYU', symbol: '$U', name: 'Uruguayan Peso' },
  { code: 'BOB', symbol: 'Bs', name: 'Bolivian Boliviano' },
  { code: 'PYG', symbol: '₲', name: 'Paraguayan Guaraní' },
  { code: 'VES', symbol: 'Bs.S', name: 'Venezuelan Bolívar' },
  { code: 'GTQ', symbol: 'Q', name: 'Guatemalan Quetzal' },
  { code: 'CRC', symbol: '₡', name: 'Costa Rican Colón' },
  { code: 'DOP', symbol: 'RD$', name: 'Dominican Peso' },
  { code: 'HNL', symbol: 'L', name: 'Honduran Lempira' },
  { code: 'NIO', symbol: 'C$', name: 'Nicaraguan Córdoba' },
  { code: 'PAB', symbol: 'B/.', name: 'Panamanian Balboa' },
  { code: 'CUP', symbol: '$MN', name: 'Cuban Peso' },
] as const;
