import type {
  LoanEvent,
  LoanState,
  NetWorthComponent,
  PositionState,
  PositionTrade,
  ValuationSnapshot,
} from '@/types/wealth';

function units(value: string, label: string, signed = false): bigint {
  const pattern = signed ? /^-?(0|[1-9]\d*)$/ : /^(0|[1-9]\d*)$/;
  if (!pattern.test(value)) throw new Error(`${label} must be an integer unit string`);
  return BigInt(value);
}

function positive(value: string, label: string): bigint {
  const amount = units(value, label);
  if (amount === BigInt(0)) throw new Error(`${label} must be positive`);
  return amount;
}

export function applyPositionTrade(state: PositionState, trade: PositionTrade): PositionState {
  const quantity = units(state.quantityAtoms, 'position quantity');
  const basis = units(state.costBasisMinor, 'cost basis');
  const realized = units(state.realizedReturnMinor, 'realized return', true);
  const traded = positive(trade.quantityAtoms, 'trade quantity');
  const gross = positive(trade.grossMinor, 'trade gross');
  const fee = units(trade.feeMinor, 'trade fee');

  if (trade.kind === 'buy') {
    return {
      quantityAtoms: (quantity + traded).toString(),
      costBasisMinor: (basis + gross + fee).toString(),
      realizedReturnMinor: realized.toString(),
    };
  }
  if (traded > quantity) throw new Error('insufficient quantity');
  const allocatedBasis =
    traded === quantity ? basis : (basis * traded + quantity / BigInt(2)) / quantity;
  return {
    quantityAtoms: (quantity - traded).toString(),
    costBasisMinor: (basis - allocatedBasis).toString(),
    realizedReturnMinor: (realized + gross - fee - allocatedBasis).toString(),
  };
}

export function valuePosition(
  state: PositionState,
  snapshot: ValuationSnapshot,
): ValuationSnapshot & { unrealizedReturnMinor: string; realizedReturnMinor: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshot.asOf)) throw new Error('valuation date required');
  const marketValue = units(snapshot.marketValueMinor, 'market value');
  const basis = units(state.costBasisMinor, 'cost basis');
  const realized = units(state.realizedReturnMinor, 'realized return', true);
  return {
    asOf: snapshot.asOf,
    marketValueMinor: marketValue.toString(),
    unrealizedReturnMinor: (marketValue - basis).toString(),
    realizedReturnMinor: realized.toString(),
  };
}

export function applyLoanEvent(
  state: LoanState,
  event: LoanEvent,
): { state: LoanState; cashDeltaMinor: string; spendingMinor: string } {
  const outstanding = units(state.outstandingMinor, 'outstanding principal');
  const interestTotal = units(state.interestExpenseMinor, 'interest expense');
  const insuranceTotal = units(state.insuranceExpenseMinor, 'insurance expense');
  const feeTotal = units(state.feeExpenseMinor, 'fee expense');

  if (event.kind === 'disbursement') {
    const principal = positive(event.principalMinor, 'disbursement principal');
    return {
      state: { ...state, outstandingMinor: (outstanding + principal).toString() },
      cashDeltaMinor: principal.toString(),
      spendingMinor: '0',
    };
  }

  const paid = positive(event.cashPaidMinor, 'cash paid');
  const principal = units(event.principalMinor, 'payment principal');
  const interest = units(event.interestMinor, 'payment interest');
  const insurance = units(event.insuranceMinor, 'payment insurance');
  const fee = units(event.feeMinor, 'payment fee');
  if (principal + interest + insurance + fee !== paid) {
    throw new Error('payment allocation must equal cash paid');
  }
  if (principal > outstanding) throw new Error('principal exceeds outstanding loan');
  return {
    state: {
      outstandingMinor: (outstanding - principal).toString(),
      interestExpenseMinor: (interestTotal + interest).toString(),
      insuranceExpenseMinor: (insuranceTotal + insurance).toString(),
      feeExpenseMinor: (feeTotal + fee).toString(),
    },
    cashDeltaMinor: (-paid).toString(),
    spendingMinor: (interest + insurance + fee).toString(),
  };
}

export function createAssetTransfer(
  fromId: string,
  toId: string,
  currency: string,
  amountMinor: string,
): {
  postings: { accountId: string; currency: string; deltaMinor: string }[];
  spendingMinor: string;
} {
  if (!fromId || !toId || fromId === toId) throw new Error('distinct transfer accounts required');
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('currency must be an ISO code');
  const amount = positive(amountMinor, 'transfer amount');
  return {
    postings: [
      { accountId: fromId, currency, deltaMinor: (-amount).toString() },
      { accountId: toId, currency, deltaMinor: amount.toString() },
    ],
    spendingMinor: '0',
  };
}

/** Produces separate totals; a consolidated amount requires a dated FX quote. */
export function calculateNetWorthByCurrency(
  components: NetWorthComponent[],
): Record<string, string> {
  const totals = new Map<string, bigint>();
  const ids = new Set<string>();
  for (const component of components) {
    if (!component.id || ids.has(component.id)) throw new Error('duplicate net worth component');
    if (!/^[A-Z]{3}$/.test(component.currency)) throw new Error('currency must be an ISO code');
    ids.add(component.id);
    const value = units(component.valueMinor, 'net worth value');
    const sign = component.kind === 'asset' ? BigInt(1) : -BigInt(1);
    totals.set(component.currency, (totals.get(component.currency) ?? BigInt(0)) + sign * value);
  }
  return Object.fromEntries([...totals].map(([currency, value]) => [currency, value.toString()]));
}
