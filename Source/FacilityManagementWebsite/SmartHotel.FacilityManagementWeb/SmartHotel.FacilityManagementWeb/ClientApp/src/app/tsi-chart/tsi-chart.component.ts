import { Component, OnInit, Input, OnChanges } from '@angular/core';
import { AdalService } from 'adal-angular4';
import TsiClient from 'tsiclient';
import { environment } from 'src/environments/environment';
import { FacilityService } from '../services/facility.service';

@Component({
  selector: 'app-tsi-chart',
  templateUrl: './tsi-chart.component.html',
  styleUrls: ['./tsi-chart.component.css']
})
export class TsiChartComponent implements OnInit, OnChanges {

  @Input() public motionSensorIds: string[];
  @Input() public lightSensorIds: string[];
  @Input() public tempSensorIds: string[];

  private tokenRetrieved = false;
  private token: string;
  private client: any;
  
  constructor(private adalService: AdalService, private facilityService: FacilityService) {
  }

  private initializeChart() {
    const lineChart = this.client.ux.LineChart(document.getElementById('tsichart'));

    const dateTimeNowUTC = new Date();
    const thirtyDaysBack = new Date();
    thirtyDaysBack.setDate(dateTimeNowUTC.getDate() - Number(environment.tsiHowManyDays));
    
    const startDate = thirtyDaysBack.toISOString();
    const endDate = dateTimeNowUTC.toISOString();

    const motionPredicate = this.buildPredicateString(this.motionSensorIds);
    const lightPredicate = this.buildPredicateString(this.lightSensorIds);
    const tempPredicate = this.buildPredicateString(this.tempSensorIds);

    const aggregateExpressions = [];

    aggregateExpressions.push(
      new this.client.ux.AggregateExpression(
        { predicateString: motionPredicate }, // predicate
        { property: 'Occupied', type: 'Double' }, // measure column
        ['avg'], // measure type,
        { from: startDate, to: endDate, bucketSize: '30m' },  // time range
        null, // split by value, for you probably just null
        '#60B9AE', // color
        'Occupied')  // display name
    );

    aggregateExpressions.push(
      new this.client.ux.AggregateExpression(
        { predicateString: lightPredicate }, // predicate
        { property: 'Light', type: 'Double' }, // measure column
        ['avg'], // measure type
        { from: startDate, to: endDate, bucketSize: '30m' },  // time range
        null, // split by value, for you probably just null
        'Green', // color
        'Light')  // display name
    );

    aggregateExpressions.push(
      new this.client.ux.AggregateExpression(
        { predicateString: tempPredicate }, // predicate
        { property: 'Temperature', type: 'Double' }, // measure column
        ['avg'], // measure type
        { from: startDate, to: endDate, bucketSize: '30m' },  // time range
        null, // split by value, for you probably just null
        'Red', // color
        'Temperature')  // display name
    );

    const currentThis = this;
    this.client.server.getAggregates(this.token, environment.tsiFqdn,
      aggregateExpressions.map(function (ae) { return ae.toTsx(); }))
      .then(function (result) {
        const transformedResult = currentThis.client.ux.transformAggregatesForVisualization(result, aggregateExpressions);
        lineChart.render(transformedResult, { legend: 'compact' }, aggregateExpressions);
      });
  }

  ngOnInit() {
    this.facilityService.executeWhenInitialized(this, this.initializeToken);
  }

  private initializeToken(self: TsiChartComponent) {
    
    console.log(environment.tsiApi);
    self.client = new TsiClient();
    self.token = self.adalService.getCachedToken(environment.tsiApi);
    if (!self.token) {
      self.adalService.acquireToken(environment.tsiApi)
        .subscribe(result => {
          self.token = result;
          console.log(`TSI Token retrieved: ${self.token}`);
          self.tokenRetrieved = true;
          self.tryUpdateChart();
        });
    } else {
      self.tokenRetrieved = true;
      self.tryUpdateChart();
    }
  }

  ngOnChanges() {
    this.tryUpdateChart();
  }

  private tryUpdateChart() {
    if (this.tokenRetrieved && this.motionSensorIds != null 
      && this.motionSensorIds.length > 0
      && this.lightSensorIds.length > 0
      && this.tempSensorIds.length > 0) {
      console.log('Sensor Ids loaded.');
      
      this.initializeChart();
    }
  }

  private buildPredicateString(sensorIds: string[]) {
    const result = sensorIds.join(`', '`);
    return `SensorId in ('${result}')`;
  }
}