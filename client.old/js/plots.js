/*
 * Copyright (c) 2015-2017 Tom Keffer <tkeffer@gmail.com>
 *
 *  See the file LICENSE for your full rights.
 */

"use strict";

/**
 * Class representing a single real-time {@link https://plot.ly/javascript Plotly.js} plot.
 * It may have multiple traces.
 *
 * This is basically the "view" of a Model-View-Controller triad.
 */
class Plot {

    /**
     * Construct a Plot object. This constructor is not intended to be used directly. Instead,
     * the static method {@link Plot.createPlot} should be used instead. This avoids having the
     * constructor take a Promise.
     * @param {object} div_element The document <tt>div</tt> element where the Plotly.js plot is located.
     * This is basically what is returned by the call to Plotly.newPlot.
     * @param {number} max_age The maximum age that should be shown on the plots in milliseconds.
     * @param {Object[]} trace_specs An array of objects, one for each trace to be included.
     * @param {String} trace_specs[].obs_type The observation type for this trace.
     */
    constructor(div_element, max_age, trace_specs) {
        this.div_element = div_element;
        this.max_age     = max_age;
        this.trace_specs = trace_specs;
    }

    /**
     * Update the plot to reflect a changed model.
     * @param {string} event_type If set to <tt>new_packet</tt> then the <tt>event_data</tt> should
     * be a new deep packet that is to be added on to the end of the plot. If set to <tt>reload</tt>
     * then <tt>event_data</tt> should be new x- and y-vectors, along with a new <tt>max_age</tt>.
     * @param {object} event_data The new model data.
     */
    update(event_type, event_data) {
        if (event_type === 'new_packet') {
            return this.extend(event_data);
        } else if (event_type === 'reload') {
            return this.replace(event_data.packets, event_data.max_age);
        }
    }

    /*
     * Extend the plot with a new data point.
     */
    extend(packet) {
        let Nkeep;
        let x = this.div_element.data[0].x;
        if (x.length) {
            let lastTimestamp = x[x.length - 1];
            let trim_time     = lastTimestamp - this.max_age;
            let first_good    = x.findIndex(function (xval) {
                return xval >= trim_time;
            });

            if (first_good === -1) {
                // All data points have expired. Keep none of them.
                Nkeep = 0;
            } else if (first_good === 0) {
                // They are all good. Don't trim anything
                Nkeep = undefined;
            } else {
                // The points before first_good have expired. Keep the rest.
                Nkeep = x.length - first_good;
            }
        }

        // Each trace gets an index
        let new_xs        = [];
        let new_ys        = [];
        let trace_numbers = [];
        for (let j = 0; j < this.trace_specs.length; j++) {
            new_xs.push([packet.timestamp]);
            new_ys.push([packet.fields[this.trace_specs[j].obs_type]]);
            trace_numbers.push(j);
        }
        return Plotly.extendTraces(this.div_element, {
            x: new_xs,
            y: new_ys
        }, trace_numbers, Nkeep);
    }

    /*
     * Replace the plot data with totally new data.
     */
    replace(packet_array, max_age) {
        this.max_age    = max_age;
        for (let i = 0; i < this.trace_specs.length; i++) {

            let obs_type = this.trace_specs[i].obs_type;

            this.div_element.data[i].x = packet_array.map(function (packet) {return packet.timestamp;});
            this.div_element.data[i].y = packet_array.map(function (packet) {return packet.fields[obs_type];});
        }
        return Plotly.redraw(this.div_element);
    }

    relayout(update) {
        return Plotly.relayout(this.div_element, update);
    }

    /**
     * Static method to create a single Plotly.js plot, using a DataManager as a data source.
     * @param {String} plot_div The id of the document <tt>div</tt> where the plot will be put.
     * @param {DataManager} datamanager The {@link DataManager} object to be used as the data source
     * for this plot.
     * @param {Layout} plot_layout A Plotly {@link https://plot.ly/javascript/reference/#layout Layout} object to
     * be used for this plot.
     * @param {Object[]} trace_specs An array of objects, one for each trace to be included.
     * @param {String} trace_specs[].label The label to be used for this trace.
     * @param {String} trace_specs[].obs_type The observation type for this trace.
     * @returns {Promise} A promise to create a {@link Plot} object.
     */
    static createPlot(plot_div, datamanager, plot_layout, trace_specs) {
        // Assemble the trace data.
        let data = [];
        for (let trace of trace_specs) {
            data.push({
                          x   : datamanager.packets.map(function (packet) {return packet.timestamp;}),
                          y   : datamanager.packets.map(function (packet) {return packet.fields[trace.obs_type];}),
                          mode: "lines",
                          type: "scatter",
                          name: trace.label
                      });
        }
        return Plotly.newPlot(plot_div, data, plot_layout)
                     .then((plotly) => {
                         // Return the resolved promise of a new Plot object
                         return Promise.resolve(new Plot(plotly, datamanager.max_age, trace_specs));
                     });
    }
}

/**
 * Represents a group of plots, managed as a whole.
 */
class PlotGroup {

    /**
     * Construct a new plot group.
     * @param {Plots} plots An array of {@link Plots} objects.
     * @param {DataManager} datamanager The {@link DataManager} object to be used as the data source
     * for this plot.
     */
    constructor(plots, data_manager) {
        this.plots = plots;
        // Set the callback for new packets
        for (let i = 0; i < this.plots.length; i++) {
            data_manager.subscribe(Plot.prototype.update.bind(this.plots[i]));
        }
    }

    relayout(update) {
        let promises = [];
        for (let i = 0; i < this.plots.length; i++) {
            promises.push(this.plots[i].relayout(update));
        }
        return Promise.all(promises);
    }

    /**
     * Static function to create a {@link PlotGroup} from a plot_group specification.
     * @param {DataManager} data_manager The {@link DataManager} object to be used as the data source
     * for this plot.
     * @param {object} plot_group_spec Specifies which plots to create
     * @param {string} plot_group_spec.time_group The name of the time group for this plot. Something
     * like <tt>recent</tt> or <tt>day</tt>. This is used to figure out which <tt>div</tt> to put the plots in.
     * @param {string} plot_group_spec.measurement Which measurement should be used to populate the group.
     * @param {object[]} plot_group_spec.plot_list An array of individual plot specifications.
     */
    static createPlotGroup(data_manager, plot_group_spec) {
        let promises = [];
        for (let plot_spec of plot_group_spec.plot_list) {
            promises.push(
                Plot.createPlot(
                    plot_group_spec.time_group + '-' + plot_spec.div_root,
                    data_manager,
                    plot_spec.layout,
                    plot_spec.traces)
            );
        }
        return Promise.all(promises)
                      .then(plots => {
                          return Promise.resolve(new PlotGroup(plots, data_manager));
                      });
    }
}