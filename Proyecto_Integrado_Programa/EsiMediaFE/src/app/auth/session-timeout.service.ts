import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class SessionTimeoutService {


  private readonly WARNING_MS = 5_00000;
  private readonly EXTRA_MS = 10_00000;

  private warningTimeoutId: any = null;
  private logoutTimeoutId: any = null;
  private countdownIntervalId: any = null;

  private enabled = false;

  private warningVisibleSubject = new BehaviorSubject<boolean>(false);
  readonly warningVisible$ = this.warningVisibleSubject.asObservable();

  private countdownSubject = new BehaviorSubject<number | null>(null);
  readonly countdown$ = this.countdownSubject.asObservable();

  constructor(
    private auth: AuthService,
    private router: Router
  ) {}

  start(): void {
    this.enabled = true;
    this.resetTimersIfLogged();
  }

  stop(): void {
    this.enabled = false;
    this.clearTimers();
    this.hideWarningModal();
  }

  userActivity(): void {
    if (!this.enabled) return;

    const user = this.auth.getCurrentUser();
    if (!user) {
      this.clearTimers();
      this.hideWarningModal();
      return;
    }

    
    if (this.warningVisibleSubject.value) {
      this.hideWarningModal();
    }

    this.resetTimers();
  }

  stayConnectedFromModal(): void {
    if (!this.enabled) return;
    this.hideWarningModal();
    this.resetTimersIfLogged();
  }

  logoutFromModal(): void {
    this.forceLogout();
  }


  private resetTimersIfLogged(): void {
    const user = this.auth.getCurrentUser();
    if (!user) {
      this.clearTimers();
      this.hideWarningModal();
      return;
    }
    this.resetTimers();
  }

  private resetTimers(): void {
    this.clearTimers();

    
    this.warningTimeoutId = setTimeout(
      () => this.showWarningModal(),
      this.WARNING_MS
    );

    this.logoutTimeoutId = setTimeout(
      () => this.forceLogout(),
      this.WARNING_MS + this.EXTRA_MS
    );
  }

  private clearTimers(): void {
    if (this.warningTimeoutId !== null) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
    if (this.logoutTimeoutId !== null) {
      clearTimeout(this.logoutTimeoutId);
      this.logoutTimeoutId = null;
    }
  }

  private showWarningModal(): void {
    const user = this.auth.getCurrentUser();
    if (!user || !this.enabled) return;

    this.warningVisibleSubject.next(true);
    this.startCountdown();
  }

  private hideWarningModal(): void {
    this.warningVisibleSubject.next(false);
    this.countdownSubject.next(null);
    this.clearCountdown();
  }

  private startCountdown(): void {
    this.clearCountdown();
    let secondsLeft = this.EXTRA_MS / 1000; 

    this.countdownSubject.next(secondsLeft);

    this.countdownIntervalId = setInterval(() => {
      secondsLeft -= 1;
      this.countdownSubject.next(secondsLeft);

      if (secondsLeft <= 0) {
        this.forceLogout();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownIntervalId !== null) {
      clearInterval(this.countdownIntervalId);
      this.countdownIntervalId = null;
    }
  }

  private forceLogout(): void {
    this.clearTimers();
    this.hideWarningModal();
    this.enabled = false;

    this.auth.logout();                  
    this.router.navigate(['/auth/login']); 
  }
}
