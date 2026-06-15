'use strict';

class DayNightCycle {
  constructor() {
    this.isNight = false;
    this.timeToSunset = 0;
    this.timeToSunrise = 0;

    this.dayDuration = 5 * 60;   // seconds
    this.nightDuration = 5 * 60; // seconds
  }

  startDay() {
    this.isNight = false;
    this.timeToSunset = this.dayDuration;
    this.timeToSunrise = 0;
  }

  update(dt) {
    const events = { sunset: false, sunrise: false };

    if (!this.isNight) {
      this.timeToSunset = Math.max(0, this.timeToSunset - dt);
      if (this.timeToSunset <= 0) {
        this.isNight = true;
        this.timeToSunrise = this.nightDuration;
        events.sunset = true;
      }
    } else {
      this.timeToSunrise = Math.max(0, this.timeToSunrise - dt);
      if (this.timeToSunrise <= 0) {
        this.isNight = false;
        this.timeToSunset = this.dayDuration;
        events.sunrise = true;
      }
    }

    return events;
  }

  get hudText() {
    const t = this.isNight ? this.timeToSunrise : this.timeToSunset;
    const label = this.isNight ? 'Time till sunrise' : 'Time till sunset';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${label}: ${m}:${String(s).padStart(2, '0')}`;
  }
}
