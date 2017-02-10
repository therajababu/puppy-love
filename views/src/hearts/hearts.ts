import { Component, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { Http } from '@angular/http';
import { contentHeaders } from '../common/headers';
import { Config } from '../config';
import { Person } from '../common/person';
import { Option, Crypto } from '../common/crypto';
import { DataService } from '../data.service';
import { ToastService } from '../toasts';
import { PubkeyService } from '../pubkey.service';

const styles   = require('./hearts.css');
const template = require('./hearts.html');

@Component({
  selector: 'hearts',
  template: template,
  styles: [ styles ]
})
export class Hearts {
  constructor(public http: Http,
              public dataservice: DataService,
              public t: ToastService,
              public pks: PubkeyService) {
  }

  ngOnInit() {
    this.dataservice.emitdone.subscribe(x => {
      setTimeout(() => {
        this.getmorehearts();
      }, 2000);
    });
    this.dataservice.emitsend.subscribe(x => this.sendvotes());
  }

  sendvotes() {
    let tosend = [];

    for (let p of this.dataservice.choices) {
      if (this.dataservice.votessentto.indexOf(p.roll) === -1) {

        let pubk = this.pks.pubkeys[p.roll];

        if (!pubk) {
          continue;
        }

        // Instantiate a crypto instance for this person
        let cry = new Crypto();
        cry.deserializePub(pubk);

        tosend.push({'v': cry.encryptAsym(Crypto.getRand(2))});
      }
    }

    if (tosend.length === 0) return;

    this.http.post(Config.voteSend, tosend)
      .subscribe(
        response => {
          // Mark these people as done
          let toadd = [];
          for (let p of this.dataservice.choices) {
            if (this.dataservice.votessentto.indexOf(p.roll) === -1) {
              toadd.push(p.roll);
            }
          }
          this.dataservice.votessentto =
            this.dataservice.votessentto.concat(toadd);
          setTimeout(() => this.dataservice.save(), 3000);
        },
        error => this.toast('Could not send votes'));
  }

  getmorehearts() {
    this.toast('Fetching more hearts, just for you.. Please wait.');
    let ctime = new Date().valueOf();

    // Hack of the day
    if (this.dataservice.lastcheck.toString().substring(0, 4) === '2017') {
      // You need medication
      this.dataservice.lastcheck = 0;
      this.dataservice.save();
    }

    this.http.get(Config.voteGet + '/' + this.dataservice.lastcheck)
      .subscribe(
        response => {
          try {
            let resp = JSON.parse(response['_body']);

            console.log('New votes since last time =>');
            console.log(resp);

            let totalvotes = resp.votes.length;
            let vote;
            let voteparse = (fromindex: number) => {
              if (fromindex >= totalvotes) return;
              console.log('Vote number: ' + fromindex);
              vote = resp.votes[fromindex];
              let dec_res: Option<string> =
                this.dataservice.crypto.decryptAsym(vote.v);

              if (dec_res.isNone()) {
                console.log('Could not catch vote');
              } else {
                this.dataservice.hearts = this.dataservice.hearts + 1;
                this.toast('New heart!');
              }

              fromindex = fromindex + 1;
              if (fromindex % 5 === 0) {
                setTimeout(() => {
                  voteparse(fromindex);
                }, 100);
              } else {
                voteparse(fromindex);
              }
            };
            voteparse(0);

            this.dataservice.lastcheck = resp.time;
            this.dataservice.save();

          } catch (err) {
            this.toast('Bad response for votes');
            console.error('Could not parse vote response');
            console.error(err);
          }
        },
        error => this.toast('Could not get votes')
      );
  }

  range(value) {
    let a = [];
    for (let i = 0; i < value; ++i) {
      a.push(i + 1);
    }
    return a;
  }

  toast(val: string) {
    this.t.toast(val);
  }
}
