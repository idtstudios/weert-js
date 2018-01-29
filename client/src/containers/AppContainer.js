/*
 * Copyright (c) 2017-2018 Tom Keffer <tkeffer@gmail.com>
 *
 *  See the file LICENSE for your full rights.
 *
 */
import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';

import {selectTimeScale, fetchMeasurementIfNeeded, subscribeMeasurement} from '../actions';
import PacketTable from '../components/PacketTable';
import WindCompass from '../components/WindCompass';
import StatsTable from '../components/StatsTable';
import PlotGroup from '../components/PlotGroup';
import Picker from '../components/Picker';

const propTypes = {
    selectedTimeScale: PropTypes.string.isRequired,
    dispatch         : PropTypes.func.isRequired
};

class AppContainer extends React.PureComponent {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.state        = {subscriptions: {}};
    }

    componentDidMount() {
        const {selectedTimeScale} = this.props;
        // We always need the most recent packets:
        this.fetchAndSubscribeIfNeeded('day');
        // We may also need wxrecords:
        if (selectedTimeScale !== 'day') {
            this.fetchAndSubscribeIfNeeded(selectedTimeScale);
        }
    }

    componentWillUnmount() {
        // Cancel all subscriptions
        for (let subscription of Object.values(this.state.subscriptions)) {
            subscription.cancel();
        }
        // Reset the collection of subscriptions.
        this.setState({...this.state, subscriptions: {}});
    }

    componentDidUpdate(prevProps) {
        if (this.props.selectedTimeScale !== prevProps.selectedTimeScale) {
            this.fetchAndSubscribeIfNeeded(this.props.selectedTimeScale);
        }
    }

    handleChange(nextTimeScale) {
        this.props.dispatch(selectTimeScale(nextTimeScale));
        this.fetchAndSubscribeIfNeeded(nextTimeScale);
    }

    fetchAndSubscribeIfNeeded(timeScale) {
        const measurement              = timeScale === 'day' ? 'wxpackets' : 'wxrecords';
        const {dispatch, selectedTags} = this.props;
        dispatch(fetchMeasurementIfNeeded(measurement));
        // Before subscribing, check to see if we already have a subscription for this series
        if (!this.state.subscriptions[measurement]) {
            // Subscribe to any new packets coming from the given series
            const subscription = dispatch(subscribeMeasurement(measurement, selectedTags));
            // Save the new subscription object. It will be needed to cancel the subscription.
            this.setState({...this.state, subscriptions: {...this.state.subscriptions, [measurement]: subscription}});
        }
    }

    render() {
        const currentPacket           = this.props.measurements['wxpackets'].packets[this.props.measurements['wxpackets'].packets.length - 1];
        const isFetchingCurrentPacket = this.props.measurements['wxpackets'].isFetching;

        const {
                  selectedTimeScale,
                  packetTableProps,
                  windCompassProps,
                  statsTableProps,
                  plotGroupProps
              }                   = this.props;
        const selectedMeasurement = selectedTimeScale === 'day' ? 'wxpackets' : 'wxrecords';
        const selectedState = this.props.measurements[selectedMeasurement];

        return (
            <div>
                <div>
                    <Picker
                        value={selectedTimeScale}
                        onChange={this.handleChange}
                        options={['day', 'week', 'month', 'year']}
                    />
                </div>
                <div style={{width: '50%'}}>
                    <PacketTable {...packetTableProps}
                                 packet={currentPacket}
                                 isFetching={isFetchingCurrentPacket}/>
                    <WindCompass {...windCompassProps}
                                 packet={currentPacket}
                                 isFetching={isFetchingCurrentPacket}/>
                </div>

                <div>
                    <StatsTable {...statsTableProps}
                                stats={selectedState.stats}
                                isFetching={selectedState.isFetching}/>
                </div>
                <div>
                    <PlotGroup {...plotGroupProps}
                               selectedTimeScale={selectedTimeScale}
                               packets={selectedState.packets}
                               aggregation={selectedState.aggregation}
                               isFetching={selectedState.isFetching}
                    />
                </div>

            </div>
        );
    }
}

AppContainer.propTypes = propTypes;

function mapStateToProps(state) {
    return state;
}

export default connect(mapStateToProps)(AppContainer);