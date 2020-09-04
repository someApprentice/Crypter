import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { MainComponent } from './components/main/main.component';
import { ConferencesComponent } from './components/messenger/conferences/conferences.component';
import { PrivateConferenceComponent } from './components/messenger/conferences/conference/private/private-conference.component';
import { SecretConferenceComponent } from './components/messenger/conferences/conference/secret/secret-conference.component';
// import { PublicConferenceComponent } from './components/messenger/conferences/conference/public/public-conference.component';

import { NotFoundComponent } from './components/not-found/not-found.component';

const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    data: { animation: 'WelcomePage' },
    children: [
      { path: '', component: ConferencesComponent, data: { animation: 'ConferencesPage' } },
      { path: 'conference/u/:uuid', component: PrivateConferenceComponent, data: { animation: 'PrivateConferencePage' } },
      { path: 'conference/s/:uuid', component: SecretConferenceComponent, data: { animation: 'SecretConferencePage' } }
      // { path: 'conference/p/:uuid', component: PublicConferenceComponent }
    ]
  },
  { path: '**', component: NotFoundComponent},
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
