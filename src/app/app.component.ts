/* elementState oznacava u kojem stanju je odabrani element:
      blank - na elementu se ne nalazi nista (type: 0)
      start - element oznacava pocetnu lokaciju
      end - element oznacava ciljanu zavrsnu lokaciju
      boulder - na elementu se nalazi prepreka kroz koju se ne moze proci (type: 2)
      gravel - na elementu se nalazi prepreka koja omogucava prolazak ali duplo usporava kretanje preko nje (type: 1)
      wormholeEntrance - na elementu se nalazi ulaz u crvotocinu
      wormholeExit - na elementu se nalazi izlaz iz crvotocine
*/

import { Component, OnInit } from '@angular/core';
import { Config } from './config';
import { MessageService } from 'primeng/api';
import { PathFinding, Heuristic } from 'astarjs';
import { DialogService } from 'primeng/dynamicdialog';
import { HelpComponent } from './help/help.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  // broj redaka grida
  gridRowsNum = 10;
  // broj stupaca grida
  gridColumnsNum = 10;
  // ukupan broj elemenata grida
  gridElementsNum = this.gridRowsNum * this.gridColumnsNum;
  // niz elemenata grida
  gridElementsArray = [] as any;
  // matrica elemenata grida
  gridElementsMatrix = [] as any;
  // trenutno odabrani element za grid
  userState = '';
  // flag za iskoristenost pocetne pozicije
  startUsed = false;
  // flag za iskoristenost zavrsne pozicije
  endUsed = false;
  // koordinate pocetne pozicije
  startPosition = {row: 0, col: 0};
  // koordinate zavrsne pozicije
  endPosition = {row: 0, col: 0};
  // niz koordinata ulaza u crvotocinu
  wormholeEntrancePositions = [] as any;
  // niz koordinata izlaza iz crvotocine
  wormholeExitPositions = [] as any;
  // odreduje koju velicinu png-a se koristi
  imgSize = 64;
  // regex izraz za unos samo brojeva kod definiranja velicine grida
  numbers: RegExp = /^[0-9]*$/;
  // niz koordinata koji sadrzi nabrzi put od pocetne do zavrsne lokacije
  bestPath = [] as any;
  // niz koordinata koji sadrzi nabrzi put od pocetne do zavrsne lokacije kroz crvotocinu ako postoji
  bestPathWormhole = [] as any;

  constructor(
    public config: Config,
    public messageService: MessageService,
    public dialogService: DialogService
  ) { }

  ngOnInit(): void {
    // postavljanje pocetne teme
    document.documentElement.setAttribute('data-theme', this.config.theme);
    // punjenje niza elemenata grida
    this.fillGridElementsArray();
  }

  // promjena teme (light, dark)
  changeTheme(theme: string): void {
    this.config.theme = theme;
    document.documentElement.setAttribute('data-theme', this.config.theme);
  }

  // popup dialog sa pojasnjenjima pojedinih elemenata
  help(): void {
    const ref = this.dialogService.open(HelpComponent, {
      data: {},
      contentStyle: { 'max-height': '800px', width: '700px', padding: '0px', 'margin-top': '-1px' },
      header: 'Help',
    });
  }

  // funkcija za punjenje niza elemenata grida i stvaranje matrice grida
  fillGridElementsArray(): void {
    let r = 0;
    let c = 0;
    /* stvaranje niza elemenata grida. Za svaki element se postavlja:
        index unutar niza,
        koordinate unutar grida (row, col),
        stanje elementa (blank, start, end, boulder, gravel, wormholeEntrance, wormholeExit),
        varijabla za iscrtavanje puta
    */
    for (let i = 0 ; i < this.gridElementsNum ; i++) {
      this.gridElementsArray.push({elementIndex: i, row: r, col: c, elementState: 'blank', path: false});
      if (c === this.gridColumnsNum - 1) {
        r++;
        c = 0;
      } else {
        c++;
      }
    }

    // stvaranje matrice elemenata grida. Inicijalno je cijela matrica prazna (0)
    for (let i = 0 ; i < this.gridRowsNum ; i++) {
      const temp = [];
      for (let j = 0 ; j < this.gridColumnsNum ; j++) {
        temp.push(0);
        if (j === this.gridColumnsNum - 1) {
          this.gridElementsMatrix.push(temp);
        }
      }
    }
  }

  // funkcija za resetiranje i postavljanje velicine grida
  setGridElements(): void {
    // praznjenje varijabli
    this.gridElementsArray = [];
    this.gridElementsMatrix = [];
    this.userState = '';
    this.gridElementsNum = this.gridRowsNum * this.gridColumnsNum;
    this.startUsed = false;
    this.endUsed = false;
    this.wormholeEntrancePositions = [];
    this.wormholeExitPositions = [];
    this.startPosition.row = 0;
    this.startPosition.col = 0;
    this.endPosition.row = 0;
    this.endPosition.col = 0;

    // promjena css-a grida
    const a = document.getElementById('grid');
    if (a) {
      a.style.gridTemplateRows = 'repeat(' + this.gridRowsNum + ', 1fr)';
      a.style.gridTemplateColumns = 'repeat(' + this.gridColumnsNum + ', 1fr)';
    }

    // poziv funkcije za stvaranje niza i matrice grida
    this.fillGridElementsArray();

    // provjera velicine celije grida zbog odabira velicine png-a za elemente
    let gridElementWidth = 0;
    let gridElementHeight = 0;
    const b = document.getElementById('el0');
    if (b) {
      gridElementWidth = b.offsetWidth;
      gridElementHeight = b.offsetHeight;
      if (gridElementWidth < 75 || gridElementHeight < 75) {
        this.imgSize = 32;
      } else if (gridElementWidth < 128 || gridElementHeight < 128) {
        this.imgSize = 64;
      }
    }
  }

  // funkcija odabira elementa unutar grida
  gridElementClick(element: any): void {
    // ako je odabran element 'start'
    if (this.userState === 'start') {
      if (this.startUsed === false) {
        this.gridElementsArray[element.elementIndex].elementState = this.userState;
        this.startUsed = true;
        this.startPosition.row = element.row;
        this.startPosition.col = element.col;
      }
    }
    // ako je odabran element 'end'
    else if (this.userState === 'end') {
      if (this.endUsed === false) {
        this.gridElementsArray[element.elementIndex].elementState = this.userState;
        this.endUsed = true;
        this.endPosition.row = element.row;
        this.endPosition.col = element.col;
      }
    }
    // ako je odabran jedan od ostalih elemenata
    else {
      // ako se kliknulo na prethodno postavljeni 'start', zamjeni ga sa novim elementom
      if (this.gridElementsArray[element.elementIndex].elementState === 'start') {
        this.startUsed = false;
        this.startPosition.row = 0;
        this.startPosition.col = 0;
      }
      // ako se kliknulo na prethodno postavljeni 'end', zamjeni ga sa novim elementom
      else if (this.gridElementsArray[element.elementIndex].elementState === 'end') {
        this.endUsed = false;
        this.endPosition.row = 0;
        this.endPosition.col = 0;
      }
      // ako se kliknulo na prethodno postavljeni 'wormholeEntrance', zamjeni ga sa novim elementom
      else if (this.gridElementsArray[element.elementIndex].elementState === 'wormholeEntrance') {
        this.wormholeEntrancePositions.forEach((elementW: { col: number; row: number; }, index: number) => {
          if (element.row === elementW.row && element.col === elementW.col) {
            this.wormholeEntrancePositions.splice(index, 1);
          }
        });
      }
      // ako se kliknulo na prethodno postavljeni 'wormholeExit', zamjeni ga sa novim elementom
      else if (this.gridElementsArray[element.elementIndex].elementState === 'wormholeExit') {
        this.wormholeExitPositions.forEach((elementW: { col: number; row: number; }, index: number) => {
          if (element.row === elementW.row && element.col === elementW.col) {
            this.wormholeExitPositions.splice(index, 1);
          }
        });
      }

      // ako je odabran element 'blank'
      if (this.userState === 'blank') {
        // postavljanje vrijednosti u matrici elemenata grida
        this.gridElementsMatrix[element.row][element.col] = 0;
      }
      // ako je odabran element 'boulder'
      else if (this.userState === 'boulder') {
        // postavljanje vrijednosti u matrici elemenata grida
        this.gridElementsMatrix[element.row][element.col] = 2;
      }
      // ako je odabran element 'gravel'
      else if (this.userState === 'gravel') {
        // postavljanje vrijednosti u matrici elemenata grida
        this.gridElementsMatrix[element.row][element.col] = 1;
      }
      // ako je odabran element 'wormholeEntrance'
      else if (this.userState === 'wormholeEntrance') {
        this.wormholeEntrancePositions.push({row: element.row, col: element.col});
      }
      // ako je odabran element 'wormholeExit'
      else if (this.userState === 'wormholeExit') {
        this.wormholeExitPositions.push({row: element.row, col: element.col});
      }

      // postavljanje novog stanja u nizu elemenata grida
      this.gridElementsArray[element.elementIndex].elementState = this.userState;
    }
  }

  // funkcija za postavljanje korisnikovog odabranog stanja elementa
  setUserState(userState: string): void {
    this.userState = userState;
  }

  // izracun najbrzeg puta od startne pozicije do zavrsne pozicije
  calculateRoute(): void {
    // brisem prethodno oznaceni put
    this.gridElementsArray.forEach((elementA: { col: number; row: number; path: boolean; }) => {
        elementA.path = false;
    });

    // ukoliko nisu odabrane pocetna i zavrsna pozicija obavijesti korisnika
    if (this.startUsed === false && this.endUsed === false) {
      this.messageService.add({key: 'bc', severity: 'warn', life: 4000, summary: 'Warning', detail: 'You have not set starting and target location!'});
    }
    // ukoliko nije odabrana zavrsna pozicija obavijesti korisnika
    else if (this.startUsed === true && this.endUsed === false) {
      this.messageService.add({key: 'bc', severity: 'warn', life: 4000, summary: 'Warning', detail: 'You have not set target location!'});
    }
    // ukoliko nije odabrana pocetna pozicija obavijesti korisnika
    else if (this.startUsed === false && this.endUsed === true) {
      this.messageService.add({key: 'bc', severity: 'warn', life: 4000, summary: 'Warning', detail: 'You have not set starting location!'});
    }
    // ukoliko su odabrane pocetna i zavrsna pozicija nastavi sa izracunom
    else if (this.startUsed === true && this.endUsed === true) {
      const wormholeEntranceBestPathArray = [] as any;
      let wormholeEntranceBestPath = {} as any;
      const wormholeExitBestPathArray = [] as any;
      let wormholeExitBestPath = {} as any;
      this.bestPathWormhole = [];

      // ako su pocetna i zavrsna pozicija jedno pokraj drugoga
      if ((this.startPosition.row === this.endPosition.row && (this.startPosition.col === this.endPosition.col + 1 || this.startPosition.col === this.endPosition.col - 1)) ||
          (this.startPosition.col === this.endPosition.col && (this.startPosition.row === this.endPosition.row + 1 || this.startPosition.row === this.endPosition.row - 1))) {
        this.bestPath = [{col: this.startPosition.col, row: this.startPosition.row}, {col: this.endPosition.col, row: this.endPosition.row}];
      } else {
        // poziv funkcije za izracun najbrzeg puta
        this.bestPath = this.pathFinder(this.startPosition, this.endPosition);
        // ako postoji crvotocina sa pocetkom i krajem
        if (this.wormholeEntrancePositions.length > 0 && this.wormholeExitPositions.length > 0) {
          // ulaz
          this.wormholeEntrancePositions.forEach((element: { col: number; row: number; }, index: number) => {
            // ako su pocetna pozicija i pozicija ulaza u crvotocinu jedna pored druge
            if ((this.startPosition.row === element.row && (this.startPosition.col === element.col + 1 || this.startPosition.col === element.col - 1)) ||
                (this.startPosition.col === element.col && (this.startPosition.row === element.row + 1 || this.startPosition.row === element.row - 1))) {
              wormholeEntranceBestPathArray.push([{col: this.startPosition.col, row: this.startPosition.row}, {col: element.col, row: element.row}]);
            } else {
              wormholeEntranceBestPathArray.push(this.pathFinder(this.startPosition, element));
            }
            if (index === this.wormholeEntrancePositions.length - 1) {
              wormholeEntranceBestPath = wormholeEntranceBestPathArray.reduce((prev: any, next: any) => prev.length > next.length ? next : prev);
            }
          });
          // izlaz
          this.wormholeExitPositions.forEach((element: { col: number; row: number; }, index: number) => {
            // ako su pozicija izlaza iz crvotocine i zavrsna pozicija jedna pored druge
            if ((element.row === this.endPosition.row && (element.col === this.endPosition.col + 1 || element.col === this.endPosition.col - 1)) ||
                (element.col === this.endPosition.col && (element.row === this.endPosition.row + 1 || element.row === this.endPosition.row - 1))) {
              wormholeExitBestPathArray.push([{col: element.col, row: element.row}, {col: this.endPosition.col, row: this.endPosition.row}]);
            } else {
              wormholeExitBestPathArray.push(this.pathFinder(element, this.endPosition));
            }
            if (index === this.wormholeExitPositions.length - 1) {
              wormholeExitBestPath = wormholeExitBestPathArray.reduce((prev: any, next: any) => prev.length > next.length ? next : prev);
            }
          });
          // spajanje ulaza i izlaza iz crvotocine u jedan path
          if (wormholeEntranceBestPath.length > 0 && wormholeExitBestPath.length > 0) {
            this.bestPathWormhole = wormholeEntranceBestPath.concat(wormholeExitBestPath);
          } else {
            this.bestPathWormhole = [];
          }
        }
      }

      // crtanje puta
      if (this.bestPath.length !== 0) {
        if (this.bestPathWormhole.length !== 0) {
          if (this.bestPath.length <= this.bestPathWormhole.length) {
            // crtanje najbrzeg puta 'bestPath'
            this.bestPath.forEach((element: { col: number; row: number; }) => {
              this.gridElementsArray.forEach((elementA: { col: number; row: number; path: boolean; }) => {
                if (element.col === elementA.col && element.row === elementA.row) {
                  elementA.path = true;
                }
              });
            });
            // obavijest korisniku da je pronaden najbrzi put
            this.messageService.add({key: 'bc', severity: 'success', life: 3000, summary: 'Success', detail: 'Successfully found path from starting location to target location!'});
          } else {
            // crtanje najbrzeg puta 'bestPathWormhole'
            this.bestPathWormhole.forEach((element: { col: number; row: number; }) => {
              this.gridElementsArray.forEach((elementA: { col: number; row: number; path: boolean; }) => {
                if (element.col === elementA.col && element.row === elementA.row) {
                  elementA.path = true;
                }
              });
            });
            // obavijest korisniku da je pronaden najbrzi put
            this.messageService.add({key: 'bc', severity: 'success', life: 3000, summary: 'Success', detail: 'Successfully found path from starting location to target location!'});
          }
        } else {
          // crtanje najbrzeg puta 'bestPath'
          this.bestPath.forEach((element: { col: number; row: number; }) => {
            this.gridElementsArray.forEach((elementA: { col: number; row: number; path: boolean; }) => {
              if (element.col === elementA.col && element.row === elementA.row) {
                elementA.path = true;
              }
            });
          });
          // obavijest korisniku da je pronaden najbrzi put
          this.messageService.add({key: 'bc', severity: 'success', life: 3000, summary: 'Success', detail: 'Successfully found path from starting location to target location!'});
        }
      }
      else {
        if (this.bestPathWormhole.length !== 0) {
          // crtanje najbrzeg puta 'bestPathWormhole'
          this.bestPathWormhole.forEach((element: { col: number; row: number; }) => {
            this.gridElementsArray.forEach((elementA: { col: number; row: number; path: boolean; }) => {
              if (element.col === elementA.col && element.row === elementA.row) {
                elementA.path = true;
              }
            });
          });
          // obavijest korisniku da je pronaden najbrzi put
          this.messageService.add({key: 'bc', severity: 'success', life: 3000, summary: 'Success', detail: 'Successfully found path from starting location to target location!'});
        }
        // ako nije moguce pronaci put obavijesti korisnika
        else {
          this.messageService.add({key: 'bc', severity: 'error', life: 3000, summary: 'Warning', detail: 'Unable to find path from starting location to target location!'});
        }
      }
    }
  }

  // funkcije za izracun najbrzeg puta
  pathFinder(start: { col: number; row: number; }, end: { col: number; row: number; }): { col: number; row: number; }[] {
    const pfManager = new PathFinding();
    // type: 0, weight: 0 -> prazno polje preko kojega se moze prolaziti sa defaultnom tezinom
    // type: 1, weight: 1 -> gravel polje preko kojega se moze prolaziti ali sa duplom tezinom
    // type: 2 -> boulder polje preko kojega se ne moze prolaziti (nije navedeno u parametrima funkcije sto znaci da je neprohodno)
    pfManager.setWalkable({type: 0, weight: 0}, {type: 1, weight: 1}).setEnd(end).setStart(start);
    return pfManager.find(this.gridElementsMatrix);
  }

}
