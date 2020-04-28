import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { ConferencesComponent } from './conferences/conferences.component';

const routes: Routes = [
  // { path: '', component: MainComponent, childrens: ...},
  // { path: 'conference/:uuid', component: ConferenceComponent }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MessengerRoutingModule { }
