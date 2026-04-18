import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { AppUser, ExtendedContact } from '../types';
import { getMyWatchers, getUsersByIds } from '../firebase/firestore';

const CONTACTS_STORAGE_KEY = 'golgeArkadasContacts';

interface UseWatcherSelectionParams {
  currentUser: User | null;
}

export const useWatcherSelection = ({ currentUser }: UseWatcherSelectionParams) => {
  const [contacts, setContacts] = useState<ExtendedContact[]>([]);
  const [contactAddMsg, setContactAddMsg] = useState('');
  const [myContacts, setMyContacts] = useState<AppUser[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(CONTACTS_STORAGE_KEY);
    if (saved) {
      try {
        setContacts(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CONTACTS_STORAGE_KEY, JSON.stringify(contacts));
  }, [contacts]);

  useEffect(() => {
    if (!currentUser) return;
    getMyWatchers(currentUser.uid).then(async (uids) => {
      const profiles = await getUsersByIds(uids);
      setMyContacts(profiles);
    });
  }, [currentUser]);

  const addContactFromSearch = (user: AppUser) => {
    if (contacts.length >= 3) {
      setContactAddMsg('En fazla 3 kisi ekleyebilirsiniz.');
      return;
    }
    setContactAddMsg('');
    setContacts((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        name: user.displayName,
        type: 'app',
        userId: user.uid,
        fcmToken: user.fcmToken ?? undefined,
      },
    ]);
  };

  const removeContact = (id: string) => {
    setContacts((prev) => prev.filter((contact) => contact.id !== id));
  };

  return {
    contacts,
    contactAddMsg,
    myContacts,
    addContactFromSearch,
    removeContact,
  };
};
