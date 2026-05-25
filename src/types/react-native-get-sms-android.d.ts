declare module 'react-native-get-sms-android' {
  interface SmsFilter {
    box?: 'inbox' | 'sent' | 'draft' | 'outbox' | 'failed' | 'queued' | '';
    minDate?: number;
    maxDate?: number;
    bodyRegex?: string;
    address?: string;
    read?: 0 | 1;
    _id?: number;
    thread_id?: number;
    maxCount?: number;
    indexFrom?: number;
  }

  interface SmsMessage {
    _id: string;
    thread_id: string;
    address: string;
    person: string | null;
    date: number;
    date_sent: number;
    read: number;
    type: number;
    body: string;
  }

  function list(
    filter: string,
    failureCallback: (error: string) => void,
    successCallback: (count: number, smsList: string) => void
  ): void;

  export default { list };
}
