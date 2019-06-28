import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MainComponent } from './components/main/main.component';
import { ConferencesComponent } from './components/messenger/conferences/conferences.component';
import { ConferenceComponent } from './components/messenger/conferences/conference/conference.component';

import { NotFoundComponent } from './components/not-found/not-found.component';

const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    children: [
      { path: '', component: ConferencesComponent },
      { path: 'conference/:uuid', component: ConferenceComponent }
    ]
  },
  { path: '**', component: NotFoundComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
