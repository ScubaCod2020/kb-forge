import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { Logger } from './logger.service';
import { MatSnackBar } from '@angular/material/snack-bar';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const log = inject(Logger);
  const snack = inject(MatSnackBar);
  
  return next(req).pipe(
    catchError((err: any) => {
      if (err instanceof HttpErrorResponse) {
        log.error('HTTP', err.status, req.url, err.message);
        snack.open(`HTTP ${err.status}: ${err.message}`, 'dismiss', { duration: 4000 });
      } else {
        log.error('HTTP unknown error', err);
      }
      return throwError(() => err);
    })
  );
};
