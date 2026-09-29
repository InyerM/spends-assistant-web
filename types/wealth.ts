/** Decimal integer strings keep cash minor units and quantity atoms JSON-safe. */
export type Units = string;

export interface ReviewedEvidence {
  kind: 'manual_review' | 'statement' | 'broker_report';
  reference: string;
  observedAt: string;
  reviewedAt: string;
}

export interface PositionRecord {
  id: string;
  provider: string;
  symbol: string;
  currency: string;
  quantityScale: number;
  moneyScale: number;
  evidence: ReviewedEvidence;
}

export interface PositionState {
  quantityAtoms: Units;
  costBasisMinor: Units;
  realizedReturnMinor: Units;
}

export interface PositionTrade {
  kind: 'buy' | 'sell';
  quantityAtoms: Units;
  grossMinor: Units;
  feeMinor: Units;
}

export interface ValuationSnapshot {
  asOf: string;
  marketValueMinor: Units;
}

export interface LoanRecord {
  id: string;
  lender: string;
  currency: string;
  annualRateBasisPoints: number | null;
  termMonths: number | null;
  evidence: ReviewedEvidence;
}

export interface LoanState {
  outstandingMinor: Units;
  interestExpenseMinor: Units;
  insuranceExpenseMinor: Units;
  feeExpenseMinor: Units;
}

export type LoanEvent =
  | { kind: 'disbursement'; principalMinor: Units }
  | {
      kind: 'payment';
      cashPaidMinor: Units;
      principalMinor: Units;
      interestMinor: Units;
      insuranceMinor: Units;
      feeMinor: Units;
    };

export interface NetWorthComponent {
  kind: 'asset' | 'liability';
  id: string;
  currency: string;
  valueMinor: Units;
}
