import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ContenidosService, RatingResumen } from '../contenidos.service';
import { finalize } from 'rxjs/operators';

// 👇 IMPORTA explícitamente CommonModule, NgIf, NgFor, DecimalPipe
import { CommonModule, NgIf, NgFor, DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  // 👇 Añade todas las directivas/pipes que usas en la plantilla
  imports: [CommonModule, NgIf, NgFor, DecimalPipe],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css']
})
export class StarRatingComponent implements OnInit {
  @Input() contentId!: string;
  @Input() userEmail!: string;
  @Input() enabled = true;
  @Input() autoReproducir = false;
  @Output() rated = new EventEmitter<RatingResumen>();

  stars = [1,2,3,4,5];
  hoverValue: number | null = null;
  avg = 0; count = 0;
  loading = false;
  alreadyRated = false;
  errorMsg: string | null = null;

  constructor(private api: ContenidosService) {}

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen() {
    this.api.obtenerRating(this.contentId).subscribe({
      next: (r) => { this.avg = r.avg ?? 0; this.count = r.count ?? 0; },
      error: (e) => { this.errorMsg = e?.error?.message || 'No se pudo cargar la valoración'; }
    });
  }

  starFill(index: number): 'full'|'half'|'empty' {
    const v = this.hoverValue ?? this.avg;
    const diff = v - index;
    if (diff >= 1) return 'full';
    if (diff >= 0.5) return 'half';
    return diff > 0 ? 'half' : 'empty';
  }

  onMove(event: MouseEvent, starIndex: number) {
    if (!this.enabled || this.alreadyRated) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const half = (event.clientX - rect.left) < rect.width / 2 ? 0.5 : 1.0;
    this.hoverValue = starIndex - 1 + half;
  }
  onLeave() { if (!this.enabled || this.alreadyRated) return; this.hoverValue = null; }

  onClick(starIndex: number, event: MouseEvent) {
    if (!this.enabled || this.alreadyRated || this.loading) return;

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const half = (event.clientX - rect.left) < rect.width / 2 ? 0.5 : 1.0;
    const score = starIndex - 1 + half;
    const normalized = Math.round(score * 2) / 2;

    if (normalized < 1 || normalized > 5) return;

    this.loading = true; this.errorMsg = null;
    this.api.valorarContenido(this.contentId, normalized, this.userEmail)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: (r) => {
          this.avg = r.avg ?? normalized;
          this.count = r.count ?? (this.count + 1);
          this.alreadyRated = true;
          this.hoverValue = null;
          this.rated.emit(r);
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo registrar tu valoración';
          this.errorMsg = msg;
          if (msg.toLowerCase().includes('ya has valorado')) this.alreadyRated = true;
        }
      });
  }
}
