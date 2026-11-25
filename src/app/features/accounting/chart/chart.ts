import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, effect, input, viewChild } from '@angular/core';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

export const CHART_COLORS = ['#b63d77', '#6d55a7', '#25806b', '#ac5347', '#9061ba', '#3a789b', '#8b702d'];

/** Small reusable wrapper around Chart.js. Re-draws whenever its inputs change. */
@Component({
  selector: 'app-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { style: 'display:block' },
  styles: `.box { position: relative; height: 280px; }`,
  template: `<div class="box"><canvas #canvas role="img" [attr.aria-label]="label()"></canvas></div>`,
})
export class ChartComponent implements OnDestroy {
  readonly type = input.required<ChartType>();
  readonly labels = input.required<string[]>();
  readonly datasets = input.required<ChartConfiguration['data']['datasets']>();
  readonly label = input('Chart');

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('canvas');
  private chart?: Chart;

  constructor() {
    effect(() => {
      const el = this.canvas()?.nativeElement;
      const type = this.type();
      const data = { labels: this.labels(), datasets: this.datasets() };
      if (!el) return;
      this.chart?.destroy();
      Chart.defaults.color = getComputedStyle(el).color;
      Chart.defaults.borderColor = 'rgba(128,128,128,.25)';
      const round = type === 'doughnut' || type === 'pie';
      this.chart = new Chart(el, {
        type,
        data,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: data.datasets.length > 1 || round } },
          ...(round ? {} : { scales: { y: { beginAtZero: true } } }),
        },
      });
    });
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }
}
