import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Logger } from './logger.service';
import { MatSnackBar } from '@angular/material/snack-bar';
export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(Logger), snack = inject(MatSnackBar);
  return next(req).pipe({
    error: (err: any) => {
      if (err instanceof HttpErrorResponse) {
        log.error('HTTP', err.status, req.url, err.message);
        snack.open(`HTTP ${err.status}: ${err.message}`, 'dismiss', { duration: 4000 });
      } else { log.error('HTTP unknown error', err); }
      throw err;
    }
  } as any);
};
