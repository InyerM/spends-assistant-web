'use client';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { AiConsentNotice } from '@/components/ai-consent-notice';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { MonthSelector } from '@/components/dashboard/month-selector';
import { Textarea } from '@/components/ui/textarea';
import { useAiConsent } from '@/lib/api/queries/ai-consent.queries';
import { useFinancialChat } from '@/lib/api/mutations/financial-chat.mutations';
import { currentBudgetMonth } from '@/lib/budgets';

export default function ChatPage(): React.ReactElement {
  const t = useTranslations('financialChat');
  const [question, setQuestion] = useState('');
  const [month, setMonth] = useState(() => currentBudgetMonth().slice(0, 7));
  const [acknowledged, setAcknowledged] = useState(false);
  const consent = useAiConsent();
  const chat = useFinancialChat();
  const allowed = consent.data?.consents.financial_text === true;
  return (
    <div className='mx-auto max-w-3xl space-y-6 px-4 py-7 sm:px-6'>
      <header className='space-y-2'>
        <h1 className='text-3xl font-semibold tracking-tight'>{t('title')}</h1>
        <p className='text-muted-foreground text-sm leading-6'>{t('description')}</p>
      </header>
      {!allowed ? <AiConsentNotice scope='financial_text' /> : null}
      <form
        className='border-border bg-card space-y-5 rounded-xl border p-5'
        onSubmit={(event) => {
          event.preventDefault();
          if (allowed && acknowledged && question.trim())
            chat.mutate({ question, month, corpusAcknowledged: true });
        }}>
        <div className='space-y-2'>
          <label htmlFor='chat-month' className='text-sm font-medium'>
            {t('month')}
          </label>
          <div id='chat-month' role='group' aria-label={t('month')}>
            <MonthSelector
              year={Number(month.slice(0, 4))}
              month={Number(month.slice(5, 7)) - 1}
              onChange={(year, selectedMonth) => {
                setMonth(`${year}-${String(selectedMonth + 1).padStart(2, '0')}`);
                chat.reset();
              }}
            />
          </div>
        </div>
        <label className='flex items-start gap-3 text-sm leading-6'>
          <Checkbox
            checked={acknowledged}
            onCheckedChange={(value) => setAcknowledged(value === true)}
            className='mt-1'
          />
          <span>{t('acknowledgement')}</span>
        </label>
        <div className='space-y-2'>
          <label htmlFor='chat-question' className='text-sm font-medium'>
            {t('question')}
          </label>
          <Textarea
            id='chat-question'
            value={question}
            maxLength={2000}
            required
            rows={4}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </div>
        <Button
          variant='ai'
          type='submit'
          disabled={!allowed || !acknowledged || !question.trim() || !month || chat.isPending}>
          {chat.isPending ? t('sending') : t('send')}
        </Button>
      </form>
      {chat.isError ? (
        <p role='alert' className='text-destructive text-sm'>
          {t(chat.error.message === '429' ? 'quotaError' : 'error')}
        </p>
      ) : null}
      {chat.data ? (
        <section
          aria-live='polite'
          className='border-border bg-card space-y-4 rounded-xl border p-5'>
          <h2 className='font-semibold'>{t('answer')}</h2>
          <p className='text-sm leading-7 whitespace-pre-wrap'>
            {chat.data.insufficientContext ? t('insufficientContext') : chat.data.answer}
          </p>
          <p className='text-muted-foreground text-sm'>{t('coverage')}</p>
          {chat.data.coverage.truncated ? (
            <p role='status' className='text-sm font-medium'>
              {t('truncated')}
            </p>
          ) : null}
          <h3 className='text-sm font-semibold'>{t('sources')}</h3>
          <ul className='space-y-3'>
            {chat.data.citations.map((source) => (
              <li key={source.id} className='border-border rounded-lg border p-3'>
                <Link
                  href={source.href}
                  className='text-brand text-sm underline underline-offset-2'>
                  {t(`sourceTypes.${source.id.split(':')[0]}`)}
                </Link>
                <dl className='mt-2 space-y-1 text-xs'>
                  {Object.entries(source.record)
                    .filter(([key]) => key !== 'id')
                    .map(([key, value]) => (
                      <div key={key} className='flex flex-wrap gap-2'>
                        <dt className='text-muted-foreground'>{t(`fields.${key}`)}</dt>
                        <dd>
                          {typeof value === 'string' || typeof value === 'number' ? value : '—'}
                        </dd>
                      </div>
                    ))}
                </dl>
              </li>
            ))}
          </ul>
          <Button
            variant='outline'
            onClick={() => {
              chat.reset();
              setQuestion('');
            }}>
            {t('clear')}
          </Button>
        </section>
      ) : null}
    </div>
  );
}
