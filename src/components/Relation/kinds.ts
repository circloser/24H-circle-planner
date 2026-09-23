import {
  BadgeCheck, Briefcase, CalendarHeart, Coffee, Home, MessageCircle, Phone, Users,
  type LucideIcon,
} from 'lucide-react';
import type { FactKind, MeetKind } from '@/lib/relation';
import type { TKey } from '@/i18n/translations';

/**
 * What each kind of fact and each kind of meeting is called, and the mark it
 * is drawn with — shared by the person's card and the dialog behind it, which
 * is why they live here rather than in either one.
 */
export const FACT_LABEL: Record<FactKind, TKey> = {
  contact: 'relation.fact.contact',
  home: 'relation.fact.home',
  family: 'relation.fact.family',
  work: 'relation.fact.work',
  title: 'relation.fact.title',
};

export const FACT_ICON: Record<FactKind, LucideIcon> = {
  contact: Phone,
  home: Home,
  family: Users,
  work: Briefcase,
  title: BadgeCheck,
};

export const MEET_LABEL: Record<MeetKind, TKey> = {
  meet: 'relation.meet.meet',
  talk: 'relation.meet.talk',
  event: 'relation.meet.event',
};

export const MEET_ICON: Record<MeetKind, LucideIcon> = {
  meet: Coffee,
  talk: MessageCircle,
  event: CalendarHeart,
};
