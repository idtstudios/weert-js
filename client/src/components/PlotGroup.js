/*
 * Copyright (c) 2017-2018 Tom Keffer <tkeffer@gmail.com>
 *
 *  See the file LICENSE for your full rights.
 *
 */
// Render and format a packet
import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment/moment';
import d3 from './d3';

import {LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer} from 'recharts';

const propTypes = {
    isFetching       : PropTypes.bool.isRequired,
    packets          : PropTypes.arrayOf(PropTypes.object).isRequired,
    header           : PropTypes.string,
    tickFormat       : PropTypes.string,
    nTicks           : PropTypes.number,
    obsTypes         : PropTypes.arrayOf(PropTypes.string),
    animationDuration: PropTypes.number,
    dot              : PropTypes.bool,
    width            : PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    height           : PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    margin           : PropTypes.shape({
                                           top   : PropTypes.number,
                                           right : PropTypes.number,
                                           left  : PropTypes.number,
                                           bottom: PropTypes.number
                                       }),
    stroke           : PropTypes.string,
    debounce         : PropTypes.number,
    componentClass   : PropTypes.string,
};

const defaultProps = {
    header           : "Need a header!",
    tickFormat       : 'lll',
    nTicks           : 5,
    obsTypes         : ["wind_speed", "sealevel_pressure", "out_temperature", "in_temperature"],
    animationDuration: 500,
    dot              : false,
    width            : "95%",
    height           : 200,
    margin           : {top: 5, right: 10, left: 10, bottom: 5},
    stroke           : '#8884d8',
    debounce         : 200,
    componentClass   : 'div',
};

export default class PlotGroup extends React.PureComponent {
    constructor(props) {
        super(props);
        this.state        = {selectedDetail: 5};
        this.handleChange = this.handleChange.bind(this);
    }

    handleChange(nextSelectedDetail) {
        this.setState({selectedDetail: nextSelectedDetail});
    }

    render() {
        const {
                  isFetching,
                  packets,
                  header,
                  tickFormat,
                  nTicks,
                  obsTypes,
                  animationDuration,
                  dot,
                  width,
                  height,
                  margin,
                  stroke,
                  debounce,
                  componentClass: Component
              } = this.props;

        let domain, ticks;
        if (packets.length) {
            const tMin      = packets[0].timestamp;
            const tMax      = packets[packets.length - 1].timestamp;
            // Use d3 to pick a nice domain function.
            const domainFn  = d3.scaleTime().domain([new Date(tMin), new Date(tMax)]).nice(nTicks);
            // Use the function to pick sensible tick marks
            ticks           = domainFn.ticks(nTicks);
            // And get the domain array from the function. This will be as two strings.
            const domainStr = domainFn.domain();
            // Convert the strings to numbers, which is what react-charts expect
            domain          = [new Date(domainStr[0]).getTime(), new Date(domainStr[1]).getTime()];
        } else {
            domain = ['auto', 'auto'];
            ticks  = [];
        }

        const timeFormatter = (tick) => {return moment(tick).format(tickFormat);};

        // TODO: Need tabs to change detail
        return (
            <Component>
                {isFetching && !packets && <h3>Loading...</h3>}
                {!isFetching && !packets && <h3>Empty.</h3>}
                {packets &&
                 <div style={{opacity: isFetching ? 0.5 : 1}}>

                     <h3>{header}</h3>

                     {obsTypes.map((obsType, i) => {
                         return (
                             <div key={obsType}>
                                 <h4>{obsType} of length {packets.length}</h4>
                                 <ResponsiveContainer width={width} height={height} debounce={debounce}>
                                     <LineChart
                                         data={packets}
                                         margin={margin}>
                                         <XAxis
                                             dataKey='timestamp'
                                             domain={domain}
                                             scale='time'
                                             type='number'
                                             ticks={ticks}
                                             tickFormatter={timeFormatter}
                                         />
                                         <YAxis/>
                                         <CartesianGrid
                                             strokeDasharray='3 3'
                                         />
                                         <Tooltip
                                             labelFormatter={timeFormatter}
                                         />
                                         <Line type='linear'
                                               dataKey={obsType}
                                               stroke={stroke}
                                               dot={dot}
                                               animationDuration={animationDuration}
                                               animationEasing='linear'
                                         />
                                     </LineChart>
                                 </ResponsiveContainer>
                             </div>
                         );
                     })}
                 </div>}
            </Component>
        );
    }
}

PlotGroup.propTypes    = propTypes;
PlotGroup.defaultProps = defaultProps;
