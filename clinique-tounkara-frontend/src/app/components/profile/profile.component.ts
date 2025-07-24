import { Component, OnInit } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatCardModule],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  user: any;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.apiService.getProfile().subscribe(
      data => this.user = data,
      error => console.error(error)
    );
  }
}