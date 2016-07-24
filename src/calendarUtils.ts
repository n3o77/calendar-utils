import * as moment from 'moment';
import {Moment} from 'moment';

const DAYS_IN_WEEK: number = 7;
const WEEKEND_DAY_NUMBERS: number[] = [0, 6];

export interface WeekDay {
  date: Moment;
  isPast: boolean;
  isToday: boolean;
  isFuture: boolean;
  isWeekend: boolean;
}

export interface EventColor {
  primary: string;
  secondary: string;
}

export interface EventAction {
  label: string;
  click(event: CalendarEvent): any;
}

export interface CalendarEvent {
  start: Date;
  end?: Date;
  title: string;
  color: EventColor;
  actions?: EventAction[];
}

export interface WeekViewEvent {
  event: CalendarEvent;
  offset: number;
  span: number;
  extendsLeft: boolean;
  extendsRight: boolean;
}

export interface WeekViewEventRow {
  row: WeekViewEvent[];
}

export interface MonthViewDay extends WeekDay {
  inMonth: boolean;
  events: CalendarEvent[];
  backgroundColor?: string;
  cssClass?: string;
}

export interface MonthView {
  rowOffsets: number[];
  days: MonthViewDay[];
}

export interface DayViewEvent {
  event: CalendarEvent;
  height: number;
  width: number;
  top: number;
  left: number;
  extendsTop: boolean;
  extendsBottom: boolean;
}

export interface DayView {
  events: DayViewEvent[];
  maxWidth: number;
}

const getDaySpan: Function = (event: CalendarEvent, offset: number, startOfWeek: Moment): number => {
  let span: number = 1;
  if (event.end) {
    const begin: Moment = moment(event.start).isBefore(startOfWeek) ? startOfWeek : moment(event.start);
    span = moment(event.end)
      .endOf('day')
      .add(1, 'minute')
      .diff(begin.startOf('day'), 'days');
    if (span > DAYS_IN_WEEK) {
      span = DAYS_IN_WEEK;
    }
  }
  const totalLength: number = offset + span;
  if (totalLength > DAYS_IN_WEEK) {
    span -= (totalLength - DAYS_IN_WEEK);
  }
  return span;
};

export const getDayOffset: Function = (event: CalendarEvent, startOfWeek: Moment): number => {
  let offset: number = 0;
  if (moment(event.start).startOf('day').isAfter(moment(startOfWeek))) {
    offset = moment(event.start).startOf('day').diff(startOfWeek, 'days');
  }
  return offset;
};

interface IsEventInPeriodArgs {
  event: CalendarEvent;
  periodStart: Moment;
  periodEnd: Moment;
}

const isEventIsPeriod: Function = ({event, periodStart, periodEnd}: IsEventInPeriodArgs): boolean => {

  const eventStart: Moment = moment(event.start);
  const eventEnd: Moment = moment(event.end || event.start);

  if (eventStart.isAfter(periodStart) && eventStart.isBefore(periodEnd)) {
    return true;
  }

  if (eventEnd.isAfter(periodStart) && eventEnd.isBefore(periodEnd)) {
    return true;
  }

  if (eventStart.isBefore(periodStart) && eventEnd.isAfter(periodEnd)) {
    return true;
  }

  if (eventStart.isSame(periodStart) || eventStart.isSame(periodEnd)) {
    return true;
  }

  if (eventEnd.isSame(periodStart) || eventEnd.isSame(periodEnd)) {
    return true;
  }

  return false;

};

interface GetEventsInPeriodArgs {
  events: CalendarEvent[];
  periodStart: Moment;
  periodEnd: Moment;
}

const getEventsInPeriod: Function = ({events, periodStart, periodEnd}: GetEventsInPeriodArgs): CalendarEvent[] => {
  return events.filter((event: CalendarEvent) => isEventIsPeriod({event, periodStart, periodEnd}));
};

const getWeekDay: Function = ({date}: {date: Moment}): WeekDay => {
  const today: Moment = moment().startOf('day');
  return {
    date,
    isPast: date.isBefore(today),
    isToday: date.isSame(today),
    isFuture: date.isAfter(today),
    isWeekend: WEEKEND_DAY_NUMBERS.indexOf(date.day()) > -1
  };
};

export const getWeekViewHeader: Function = ({viewDate}: {viewDate: Date}): WeekDay[] => {

  const start: Moment = moment(viewDate).startOf('week');
  const days: WeekDay[] = [];
  for (let i: number = 0; i < DAYS_IN_WEEK; i++) {
    const date: Moment = start.clone().add(i, 'days');
    days.push(getWeekDay({date}));
  }

  return days;

};

export const getWeekView: Function = ({events, viewDate}: {events: CalendarEvent[], viewDate: Date}): WeekViewEventRow[] => {

  const startOfWeek: Moment = moment(viewDate).startOf('week');
  const endOfWeek: Moment = moment(viewDate).endOf('week');

  const eventsMapped: WeekViewEvent[] = getEventsInPeriod({events, periodStart: startOfWeek, periodEnd: endOfWeek}).map(event => {
    const offset: number = getDayOffset(event, startOfWeek);
    const span: number = getDaySpan(event, offset, startOfWeek);
    return {
      event,
      offset,
      span,
      extendsLeft: moment(event.start).isBefore(startOfWeek),
      extendsRight: moment(event.end || event.start).isAfter(endOfWeek)
    };
  }).sort((itemA, itemB): number => {
    const startSecondsDiff: number = moment(itemA.event.start).diff(moment(itemB.event.start));
    if (startSecondsDiff === 0) {
      const endA: Moment = moment(itemA.event.end || itemA.event.start);
      const endB: Moment = moment(itemB.event.end || itemB.event.start);
      return moment(endB).diff(endA);
    }
    return startSecondsDiff;
  });

  const eventRows: WeekViewEventRow[] = [];
  const allocatedEvents: WeekViewEvent[] = [];

  eventsMapped.forEach((event: WeekViewEvent, index: number) => {
    if (allocatedEvents.indexOf(event) === -1) {
      allocatedEvents.push(event);
      let rowSpan: number = event.span + event.offset;
      const otherRowEvents: WeekViewEvent[] = eventsMapped.slice(index + 1).filter(nextEvent => {
        if (
          allocatedEvents.indexOf(nextEvent) === -1 &&
          nextEvent.offset >= rowSpan &&
          rowSpan + nextEvent.span <= DAYS_IN_WEEK
        ) {
          nextEvent.offset -= rowSpan;
          rowSpan += nextEvent.span + nextEvent.offset;
          allocatedEvents.push(nextEvent);
          return true;
        }
      });
      eventRows.push({
        row: [
          event,
          ...otherRowEvents
        ]
      });
    }
  });

  return eventRows;

};

export const getMonthView: Function = ({events, viewDate}: {events: CalendarEvent[], viewDate: Date}): MonthView => {

  const start: Moment = moment(viewDate).startOf('month').startOf('week');
  const end: Moment = moment(viewDate).endOf('month').endOf('week');
  const eventsInMonth: CalendarEvent[] = getEventsInPeriod({
    events,
    periodStart: moment(viewDate).startOf('month'),
    periodEnd: moment(viewDate).endOf('month')
  });
  const days: MonthViewDay[] = [];
  for (let i: number = 0; i < end.diff(start, 'days') + 1; i++) {
    const date: Moment = start.clone().add(i, 'days');
    const day: MonthViewDay = getWeekDay({date});
    day.inMonth = date.clone().startOf('month').isSame(moment(viewDate).startOf('month'));
    if (day.inMonth) {
      day.events = getEventsInPeriod({
        events: eventsInMonth,
        periodStart: moment(date).startOf('day'),
        periodEnd: moment(date).endOf('day')
      });
    } else {
      day.events = [];
    }
    days.push(day);
  }

  const rows: number = Math.floor(days.length / 7);
  const rowOffsets: number[] = [];
  for (let i: number = 0; i < rows; i++) {
    rowOffsets.push(i * 7);
  }

  return {
    rowOffsets,
    days
  };

};

interface GetDayViewArgs {
  events: CalendarEvent[];
  viewDate: Date;
  hourSegments: number;
  dayStart: {
    hour: number;
    minute: number;
  };
  dayEnd: {
    hour: number;
    minute: number;
  };
  eventWidth: number;
  segmentHeight: number;
}

export const getDayView: Function = ({
  events, viewDate, hourSegments, dayStart, dayEnd, eventWidth, segmentHeight
}: GetDayViewArgs): DayView => {

  const startOfView: Moment = moment(viewDate)
    .startOf('day')
    .hour(dayStart.hour)
    .minute(dayStart.minute);

  const endOfView: Moment = moment(viewDate)
    .endOf('day')
    .startOf('minute')
    .hour(dayEnd.hour)
    .minute(dayEnd.minute);

  const previousDayEvents: DayViewEvent[] = [];

  const dayViewEvents: DayViewEvent[] = getEventsInPeriod({
    events: events,
    periodStart: startOfView,
    periodEnd: endOfView
  }).sort((eventA: CalendarEvent, eventB: CalendarEvent) => {
    return eventA.start.valueOf() - eventB.start.valueOf();
  }).map((event: CalendarEvent) => {

    const eventStart = event.start;
    const eventEnd = event.end || eventStart;
    const extendsTop: boolean = eventStart < startOfView.toDate();
    const extendsBottom: boolean = eventEnd > endOfView.toDate();
    const hourHeightModifier = (hourSegments * segmentHeight) / 60;

    let top: number = 0;
    if (eventStart > startOfView.toDate()) {
      top += moment(eventStart).diff(startOfView, 'minutes');
    }
    top *= hourHeightModifier;

    const startDate: Moment = extendsTop ? startOfView : moment(eventStart);
    const endDate: Moment = extendsBottom ? endOfView : moment(eventEnd);
    let height = endDate.diff(startDate, 'minutes');
    if (!event.end) {
      height = segmentHeight;
    } else {
      height *= hourHeightModifier;
    }

    const bottom = top + height;

    const overlappingPreviousEvents = previousDayEvents.filter((previousEvent: DayViewEvent) => {
      const previousEventTop = previousEvent.top;
      const previousEventBottom = previousEvent.top + previousEvent.height;

      if (top < previousEventTop && previousEventTop < bottom) {
        return true;
      } else if (top < previousEventBottom && previousEventBottom < bottom) {
        return true;
      } else if (previousEventTop <= top && bottom <= previousEventBottom) {
        return true;
      }

      return false;

    });

    const dayEvent: DayViewEvent = {
      event,
      height,
      width: eventWidth,
      top,
      left: overlappingPreviousEvents.length * eventWidth,
      extendsTop,
      extendsBottom
    };

    previousDayEvents.push(dayEvent);

    return dayEvent;

  });

  const maxWidth: number = Math.max(...dayViewEvents.map((event: DayViewEvent) => event.left + event.width));

  return {
    events: dayViewEvents,
    maxWidth
  };

};