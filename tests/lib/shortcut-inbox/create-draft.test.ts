import { describe, expect, it } from 'vitest';
import {
  buildForwardedEmailDraft,
  inferForwardedAccount,
  inferForwardedBancolombiaAccount,
  inferForwardedPaymentDestination,
  inferForwardedAccountFromRules,
  suggestForwardedCategory,
} from '@/lib/shortcut-inbox/create-draft';
import { previewLuloNotice } from '@/lib/shortcut-inbox/lulo-preview';
import { previewBancolombiaNotice } from '@/lib/shortcut-inbox/bancolombia-preview';

const receivedAt = '2026-09-26T01:20:00.000Z';
const rawText = [
  'From (unverified): notificaciones@lulobank.com',
  '',
  'Compra realizada',
  '',
  'Realizaste una compra en Demo Store por $121,000',
  'Origen tarjeta de crédito •8456',
  'Fecha 25 de septiembre de 2026',
  'Hora 7:18 p.m.',
].join('\n');
const preview = previewLuloNotice('forwarded_email', rawText, receivedAt)!;

describe('forwarded email creation draft', () => {
  it('uses unique active card evidence despite a missing time and rejects unknown senders', () => {
    const accounts = [
      {
        id: 'card',
        name: 'Lulo card',
        institution: 'Lulobank',
        type: 'credit_card' as const,
        last_four: '8456',
        currency: 'COP',
        is_active: true,
        deleted_at: null,
      },
    ];
    const partial = previewLuloNotice(
      'forwarded_email',
      rawText.replace('Hora 7:18 p.m.', ''),
      receivedAt,
    );
    expect(inferForwardedAccount(partial, accounts)).toBe('card');
    expect(
      inferForwardedAccount(partial, [...accounts, { ...accounts[0], id: 'ambiguous-card' }]),
    ).toBe('');
    expect(
      inferForwardedAccount(
        previewLuloNotice(
          'forwarded_email',
          rawText.replace('notificaciones@lulobank.com', 'unknown@example.test'),
          receivedAt,
        ),
        accounts,
      ),
    ).toBe('');
  });

  it('keeps independent Lulo date, time, and amount evidence when card evidence is missing', () => {
    const incomplete = rawText.replace(
      'Origen tarjeta de crédito •8456',
      'Tarjeta sin terminación',
    );
    const partial = previewLuloNotice('forwarded_email', incomplete, receivedAt);
    expect(partial?.kind).toBe('needs_review');
    expect(buildForwardedEmailDraft(partial, receivedAt)).toMatchObject({
      amount: '121000.00',
      date: '2026-09-25',
      eventTime: '19:18',
      eventTimeConfirmed: false,
      description: 'Demo Store',
    });
  });
  it('prefills Bancolombia evidence but requires explicit confirmation of the bank time', () => {
    const raw =
      'From (unverified): alerts@an.notificacionesbancolombia.com\n\nAlertas\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb *9989, el 05/10/2026 a las 11:46.';
    expect(
      buildForwardedEmailDraft(
        null,
        '2026-10-06T20:00:00Z',
        previewBancolombiaNotice('forwarded_email', raw),
      ),
    ).toMatchObject({
      type: 'expense',
      amount: '15000.00',
      date: '2026-10-05',
      eventTime: '11:46',
      eventTimeConfirmed: false,
      description: 'CODA.CO',
    });
  });

  it('leaves the bank date blank when the alert date was redacted', () => {
    const raw =
      'From (unverified): alerts@an.notificacionesbancolombia.com\n\nAlertas\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb *[number omitted], el 05/10/[number omitted] a las 11:46.';
    expect(
      buildForwardedEmailDraft(
        null,
        '2026-10-06T20:00:00Z',
        previewBancolombiaNotice('forwarded_email', raw),
      ),
    ).toMatchObject({
      amount: '15000.00',
      date: '',
      eventTime: '',
    });
  });

  it('does not put an explicit USD amount into a COP-only review draft', () => {
    const raw =
      'From (unverified): alerts@an.notificacionesbancolombia.com\n\nAlertas\n\nBancolombia: Compraste USD25.00 en DEMO con tu T.Cred *4899, el 05/10/2026 a las 11:46.';
    const bank = previewBancolombiaNotice('forwarded_email', raw);
    expect(bank?.currency).toBe('USD');
    expect(buildForwardedEmailDraft(null, '2026-10-06T20:00:00Z', bank).amount).toBe('');
    expect(
      inferForwardedBancolombiaAccount(raw, [
        {
          id: 'card',
          name: 'Bancolombia card',
          institution: 'Bancolombia',
          type: 'credit_card',
          last_four: '4899',
          currency: 'COP',
          is_active: true,
          deleted_at: null,
        },
      ]),
    ).toBe('');
  });
  it('prefills an older indented Lulo notice for review without confirming its time or guessing a category', () => {
    const stored = [
      'From (unverified): notificaciones@lulobank.com',
      '',
      'Compra realizada',
      '',
      '                    Realizaste una compra en CEA PRACTICAR DEL EJE por $1,550,000',
      'Origen tarjeta de crédito •8456',
      'Fecha 6 de octubre de 2026',
      'Hora 3:42 p.m.',
    ].join('\n');
    const parsed = previewLuloNotice('forwarded_email', stored, '2026-10-06T20:42:35Z');
    const account = {
      id: 'lulo-8456',
      name: 'Lulo credit card',
      institution: 'Lulobank',
      type: 'credit_card' as const,
      last_four: '8456',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };

    expect(buildForwardedEmailDraft(parsed, '2026-10-06T20:42:35Z')).toMatchObject({
      amount: '1550000.00',
      date: '2026-10-06',
      eventTime: '15:42',
      eventTimeConfirmed: false,
      description: 'CEA PRACTICAR DEL EJE',
    });
    expect(inferForwardedAccount(parsed, [account])).toBe('lulo-8456');
    expect(suggestForwardedCategory(parsed, [], [])).toBe('');
  });
  it('prefills only parsed purchase values and never confirms the event time', () => {
    expect(buildForwardedEmailDraft(preview, receivedAt)).toEqual({
      type: 'expense',
      amount: '121000.00',
      date: '2026-09-25',
      eventTime: '19:18',
      eventTimeConfirmed: false,
      description: 'Demo Store',
      notes: '',
    });
  });

  it('uses the receipt day and leaves financial fields empty for unrecognized messages', () => {
    const unknown = previewLuloNotice('forwarded_email', 'Unknown notice', receivedAt);
    expect(buildForwardedEmailDraft(unknown, receivedAt)).toMatchObject({
      amount: '',
      date: '2026-09-25',
      eventTime: '',
      description: '',
    });
  });

  it('proposes an account only for one active COP Lulo credit card with the exact suffix', () => {
    const card = {
      id: 'lulo-card',
      name: 'Lulo credit card',
      institution: 'Lulo Bank',
      type: 'credit_card' as const,
      last_four: '8456',
      bank_account_last_four: null,
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    expect(inferForwardedAccount(preview, [card])).toBe('lulo-card');
    expect(inferForwardedAccount(preview, [card, { ...card, id: 'other-card' }])).toBe('');
    expect(
      inferForwardedAccount(preview, [{ ...card, institution: 'Other Bank', name: 'Card' }]),
    ).toBe('');
  });

  it('suggests the uniquely matching Bancolombia credit card from explicit notice evidence', () => {
    const raw = [
      'From (unverified): alertas@an.notificacionesbancolombia.com',
      '',
      'Alertas y Notificaciones',
      '',
      'Bancolombia: Compraste $50.000 en TIENDAS ARA con tu T.Cred *8887',
    ].join('\n');
    const credit = {
      id: 'credit',
      name: 'Mastercard',
      institution: 'Bancolombia',
      type: 'credit_card' as const,
      last_four: '8887',
      bank_account_last_four: null,
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    const debit = { ...credit, id: 'debit', type: 'savings' as const };
    expect(inferForwardedBancolombiaAccount(raw, [credit, debit])).toBe('credit');
    expect(inferForwardedBancolombiaAccount(raw, [credit, { ...credit, id: 'second' }])).toBe('');
    expect(
      inferForwardedBancolombiaAccount(raw.replace('*8887', '*[number omitted]'), [credit]),
    ).toBe('');
    expect(
      inferForwardedBancolombiaAccount(
        raw.replace('an.notificacionesbancolombia.com', 'example.test'),
        [credit],
      ),
    ).toBe('');
  });

  it('suggests a debit account only when the Bancolombia notice says debit card', () => {
    const raw =
      'From (unverified): alertas@ayn.notificacionesbancolombia.com\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb *7799';
    const debit = {
      id: 'savings',
      name: 'Savings',
      institution: 'Bancolombia',
      type: 'savings' as const,
      last_four: '2651',
      bank_account_last_four: '7799',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    expect(inferForwardedBancolombiaAccount(raw, [debit])).toBe('savings');
    expect(inferForwardedBancolombiaAccount(raw, [{ ...debit, is_active: false }])).toBe('');
  });

  it('accepts masked suffixes in a current account detection rule', () => {
    const raw =
      'From (unverified): alertas@ayn.notificacionesbancolombia.com\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb **9989';
    const account = {
      id: 'savings',
      name: 'Savings',
      institution: 'Bancolombia',
      type: 'savings' as const,
      last_four: '2651',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    const rule = {
      rule_type: 'account_detection' as const,
      is_active: true,
      condition_logic: 'or' as const,
      conditions: { raw_text_contains: ['*7799', '*9989', '*2651'] },
      actions: { set_account: 'savings' },
    };
    expect(inferForwardedAccountFromRules(raw, [account], [rule])).toBe('savings');
  });

  it('uses an owner account rule for a Bancolombia debit alias with two masking stars', () => {
    const raw =
      'From (unverified): alerts@ayn.notificacionesbancolombia.com\n\nBancolombia: Compraste $15.000 en CODA.CO con tu T.Deb **9989';
    const account = {
      id: 'savings',
      name: 'Bancolombia',
      institution: 'bancolombia',
      type: 'savings' as const,
      last_four: '7799',
      bank_account_last_four: '2651',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    const rules = [
      {
        id: 'rule',
        user_id: 'owner',
        name: 'Account: Bancolombia',
        is_active: true,
        priority: 100,
        rule_type: 'account_detection' as const,
        condition_logic: 'or' as const,
        conditions: { raw_text_contains: ['7799', '2651', '9989'] },
        actions: { set_account: account.id },
        prompt_text: null,
        match_phone: null,
        transfer_to_account_id: null,
        created_at: '',
        updated_at: '',
      },
    ];
    expect(inferForwardedAccountFromRules(raw, [account], rules)).toBe(account.id);
    expect(inferForwardedAccountFromRules(raw.replace('**9989', '**0000'), [account], rules)).toBe(
      '',
    );
  });

  it('does not use an institution-only rule to assign a Lulo credit-card purchase to savings', () => {
    const account = {
      id: 'savings',
      name: 'Banco Lulobank',
      institution: 'lulobank',
      type: 'savings' as const,
      last_four: '',
      bank_account_last_four: null,
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    const rule = {
      id: 'rule',
      user_id: 'owner',
      name: 'Account: Lulo',
      is_active: true,
      priority: 100,
      rule_type: 'account_detection' as const,
      condition_logic: 'and' as const,
      conditions: { raw_text_contains: ['lulobank'] },
      actions: { set_account: account.id },
      prompt_text: null,
      match_phone: null,
      transfer_to_account_id: null,
      created_at: '',
      updated_at: '',
    };
    expect(inferForwardedAccountFromRules(rawText, [account], [rule])).toBe('');
  });

  it('infers the source account of a Bancolombia transfer, never the destination', () => {
    const raw =
      'From (unverified): alerts@an.notificacionesbancolombia.com\n\nTransferiste $200.000 desde tu cuenta *2651 a la cuenta *1234';
    const source = {
      id: 'source',
      name: 'Bancolombia',
      institution: 'bancolombia',
      type: 'savings' as const,
      last_four: '7799',
      bank_account_last_four: '2651',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    expect(inferForwardedBancolombiaAccount(raw, [source])).toBe(source.id);
    expect(inferForwardedBancolombiaAccount(raw.replace('2651', '0000'), [source])).toBe('');
  });

  it('recognizes the owner savings account on an incoming transfer notice', () => {
    const raw =
      'From (unverified): alerts@an.notificacionesbancolombia.com\n\nBancolombia: recibiste $100.000 en tu cuenta *2651';
    const account = {
      id: 'savings',
      name: 'Bancolombia',
      institution: 'bancolombia',
      type: 'savings' as const,
      last_four: '2651',
      currency: 'COP',
      is_active: true,
      deleted_at: null,
    };
    expect(inferForwardedBancolombiaAccount(raw, [account])).toBe('savings');
    expect(inferForwardedBancolombiaAccount(raw.replace('tu cuenta', 'la cuenta'), [account])).toBe(
      '',
    );
  });

  it('proposes a category only from recurring merchant history and an active expense category', () => {
    const history = [
      { description: 'Demo Store', type: 'expense' as const, category_id: 'food' },
      { description: 'Demo Store #123', type: 'expense' as const, category_id: 'food' },
    ];
    const category = { id: 'food', slug: 'food', type: 'expense' as const, is_active: true };
    expect(suggestForwardedCategory(preview, history, [category])).toBe('food');
    expect(suggestForwardedCategory(preview, history, [{ ...category, is_active: false }])).toBe(
      '',
    );
    expect(suggestForwardedCategory(preview, history.slice(0, 1), [category])).toBe('');
  });

  it('proposes groceries for a known supermarket without requiring two previous purchases', () => {
    const ara = previewLuloNotice(
      'forwarded_email',
      rawText.replace('Demo Store', 'TIENDAS ARA'),
      receivedAt,
    );
    const groceries = {
      id: 'groceries',
      slug: 'groceries',
      type: 'expense' as const,
      is_active: true,
    };
    expect(suggestForwardedCategory(ara, [], [groceries])).toBe('groceries');
    expect(suggestForwardedCategory(ara, [], [{ ...groceries, is_active: false }])).toBe('');
  });
});

it('identifies a unique owned repayment destination without guessing unknown or ambiguous cards', () => {
  const preview = {
    kind: 'payment' as const,
    amountDecimal: '123456.00',
    currency: 'COP' as const,
    date: '2026-10-01',
    time: '18:37',
    merchant: null,
    sourceLastFour: '5678',
    sourceKind: 'debit' as const,
    destinationLastFour: '1234',
  };
  const card = {
    id: 'card',
    name: 'Bancolombia',
    institution: 'Bancolombia',
    type: 'credit_card' as const,
    currency: 'COP',
    last_four: '1234',
    is_active: true,
    deleted_at: null,
  };
  expect(inferForwardedPaymentDestination(preview, [card])).toBe('card');
  expect(inferForwardedPaymentDestination(preview, [card, { ...card, id: 'other' }])).toBe('');
  expect(inferForwardedPaymentDestination(preview, [{ ...card, last_four: '0000' }])).toBe('');
});
