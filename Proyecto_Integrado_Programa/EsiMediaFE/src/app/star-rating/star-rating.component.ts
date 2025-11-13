import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output
} from '@angular/core';
import { CommonModule, DecimalPipe, NgForOf, NgIf } from '@angular/common';
import { finalize } from 'rxjs/operators';
import { ContenidosService, RatingResumen } from '../contenidos.service';

@Component({
  selector: 'app-star-rating',
  standalone: true,
  imports: [CommonModule, NgIf, NgForOf, DecimalPipe],
  templateUrl: './star-rating.component.html',
  styleUrls: ['./star-rating.component.css'],
})
export class StarRatingComponent implements OnInit {
  @Input() contentId!: string;
  @Input() userEmail!: string;
  @Input() enabled = true;
  @Input() autoReproducir = false;

  @Output() rated = new EventEmitter<RatingResumen>();

  stars = [1, 2, 3, 4, 5];

  /** valor actual mostrado (hover o promedio) */
  hoverValue: number | null = null;
  avg = 0;
  count = 0;
  loading = false;
  alreadyRated = false;
  errorMsg: string | null = null;

  constructor(private api: ContenidosService) {}

  ngOnInit(): void {
    this.cargarResumen();
  }

  cargarResumen(): void {
    this.api.obtenerRating(this.contentId).subscribe({
      next: (r) => {
        this.avg = r?.avg ?? 0;
        this.count = r?.count ?? 0;
      },
      error: (e) => {
        this.errorMsg =
          e?.error?.message || 'No se pudo cargar la valoración';
      }
    });
  }

  /** Valor que usamos para pintar las estrellas */
  private get currentValue(): number {
    return this.hoverValue ?? this.avg ?? 0;
  }

  /** Devuelve cómo debe verse la estrella i (1..5) según currentValue */
  starFill(index: number): 'full' | 'half' | 'empty' {
    const v = this.currentValue;
    if (v >= index) return 'full';
    if (v >= index - 0.5) return 'half';
    return 'empty';
  }

  /**
   * Calcula el valor (0.5, 1.0, 1.5, ..., 5.0) según
   * la posición del ratón DENTRO de la estrella index.
   */
  private valueFromStar(event: MouseEvent, index: number): number {
    const target = event.currentTarget as HTMLElement | null;
    if (!target) return this.currentValue;

    const rect = target.getBoundingClientRect();
    let relX = event.clientX - rect.left;

    // limitar a [0, width]
    if (relX < 0) relX = 0;
    if (relX > rect.width) relX = rect.width;

    const fraction = relX / rect.width; // 0..1 dentro de esa estrella

    // mitad izquierda => index - 0.5, mitad derecha => index
    let value = fraction <= 0.5 ? index - 0.5 : index;

    // clamp entre 0.5 y 5
    if (value < 0.5) value = 0.5;
    if (value > 5) value = 5;

    return value;
  }

  /** Hover: mientras te mueves dentro de una estrella concreta */
  onMove(event: MouseEvent, index: number): void {
    if (!this.enabled || this.alreadyRated) return;
    const val = this.valueFromStar(event, index);
    this.hoverValue = val;
  }

  onLeave(): void {
    if (!this.enabled || this.alreadyRated) return;
    this.hoverValue = null;
  }

  /** Click: usamos también la posición dentro de la estrella */
  onClick(event: MouseEvent, index: number): void {
    if (!this.enabled || this.alreadyRated || this.loading) return;

    // que el click no burbujee y nos líe otros manejadores
    event.preventDefault();
    event.stopPropagation();

    const normalized = this.valueFromStar(event, index);
    if (normalized < 0.5 || normalized > 5) return;

    this.loading = true;
    this.errorMsg = null;

    this.api
      .valorarContenido(this.contentId, normalized, this.userEmail)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (r) => {
          this.avg = r?.avg ?? normalized;
          this.count = r?.count ?? this.count + 1;
          this.alreadyRated = true;
          this.hoverValue = null;
          this.rated.emit(r);
        },
        error: (err) => {
          const msg =
            err?.error?.message || 'No se pudo registrar tu valoración';
          this.errorMsg = msg;
          if (msg.toLowerCase().includes('ya has valorado')) {
            this.alreadyRated = true;
          }
        }
      });
  }
}
