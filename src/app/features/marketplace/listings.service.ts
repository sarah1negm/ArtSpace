import { computed, inject, Injectable } from '@angular/core';
import { StudentService } from '../student/student.service';
import { ARTWORKS, Artwork } from './artworks';

@Injectable({ providedIn: 'root' })
export class ListingsService {
  private readonly students = inject(StudentService);
  readonly studentListings = computed(() =>
    this.students.publicListings().map((item): Artwork => ({
      id: item.id,
      title: item.title,
      artist: item.artist,
      description: item.description,
      price: item.price,
      image: item.imageUrl,
      category: item.category,
    })),
  );
  readonly all = computed(() => [...this.studentListings(), ...ARTWORKS]);
}
