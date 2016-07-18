/* 
	DateInput
	
	This class triggers a change event on itself whenever its year, month or day change.
 */

var DateInput = (function () {
	DateInput.prototype.year = undefined;
	DateInput.prototype.month = undefined;
	DateInput.prototype.day = undefined;
	DateInput.prototype.minDate = undefined;
	DateInput.prototype.yearInput = null;
	DateInput.prototype.monthInput = null;
	DateInput.prototype.dateInput = null;
	
    function DateInput(node, minDate) {
    	if (!node)
    		throw ("node is not specified");
    		
    	this.year = undefined;
    	this.month = undefined;
    	this.day = undefined;
    	this.minDate = minDate;
    	
    	this.yearInput = null;
    	this.monthInput = null;
    	this.dateInput = null;
    	
    	this._append(node, minDate);
    };
    
    DateInput.prototype.checkOnYearChanged = function()
    {
    	this.yearInput.selectAll(":first-child").attr('disabled', true);
    	if (this.minDate && this.year == this.minDate.getUTCFullYear())
    	{
    		minMonth = this.minDate.getUTCMonth();
    		this.monthInput.selectAll('option').each(function(d, i)
    			{
    				d3.select(this).attr('disabled', i <= minMonth ? true : null);
    			});
    		if (this.month < minMonth + 1)
    		{
    			this.monthInput.node().selectedIndex = minMonth + 1;
    		}
    	}
    	else if (this.year && this.month)
    	{
    		this.monthInput.selectAll('option').each(function(d, i)
    			{
    				d3.select(this).attr('disabled', i == 0 ? true : null);
    			});
    	}
    	else
    	{
    		this.monthInput.selectAll('option').attr('disabled', null);
    	}
    	
    	this.checkOnMonthChanged();
	}
    
    DateInput.prototype.checkOnMonthChanged = function()
    {
		dates = ['(no day)'];
		var oldDate = this.dateInput.node().selectedIndex;
		var daysInMonth = 31;	/* A dummy value for the moment. */
    	if (this.year && this.month)
    	{
			this.monthInput.selectAll(":first-child").attr('disabled', true);
			this.dateInput.selectAll('option').remove();
			var selectedYear = parseInt(this.yearInput.node().options[this.yearInput.node().selectedIndex].text);
			var selectedMonth = this.monthInput.node().selectedIndex;
			daysInMonth = (new Date(selectedYear, selectedMonth, 0)).getDate();
			for (var i = 1; i <= daysInMonth; ++i)
				dates.push(i);
		}
		this.dateInput.selectAll('option').remove();
		this.dateInput.selectAll('option')
			.data(dates)
			.enter()
			.append('option')
			.text(function(d) { return d; });

		var _this = this;
    	if (this.minDate && 
    		this.year == this.minDate.getUTCFullYear() &&
    		this.month == this.minDate.getUTCMonth()+1)
    	{
    		minDay = this.minDate.getUTCDate();
    		this.dateInput.selectAll('option').each(function(d, i)
    			{
    				d3.select(this).attr('disabled', (i == 0 && _this.day > 0) || (i > 0 && i < minDay) ? true : null);
    			});
    		if (this.day < minDay)
    		{
    			this.dateInput.node().selectedIndex = minDay;
    			this.day = minDay;
    			/* Don't reset the date to oldDate. */
    			if (oldDate < minDay)
    				oldDate = 0;
    		}
    	}
    	else if (this.day > 0)
    	{
    		this.dateInput.selectAll('option').each(function(d, i)
    			{
    				d3.select(this).attr('disabled', i == 0 ? true : null);
    			});
    	}
    	else
    	{
    		this.dateInput.selectAll('option').attr('disabled', null);
    	}

		if (oldDate > 0 && oldDate <= daysInMonth)
			this.dateInput.node().selectedIndex = oldDate;
    }
    
    DateInput.prototype.checkMinDate = function(minDate)
    {
		var yearNode = this.yearInput.node();
		var monthNode = this.monthInput.node();
		var dateNode = this.dateInput.node();

		var maxYear, minYear;
		maxYear = (new Date()).getUTCFullYear();
	
		this.minDate = minDate;
		if (minDate === undefined)
			minYear = maxYear - 100;
		else
			minYear = minDate.getUTCFullYear();

		var newNumOptions = maxYear - minYear + 2;
		if (this.yearInput.node().selectedIndex >= newNumOptions)
		{
			this.year = minYear;
			this.yearInput.node().selectedIndex = newNumOptions - 1;
		}
		
		while (this.yearInput.selectAll('option:last-child').datum() < minYear)
		{
			this.yearInput.selectAll('option:last-child').remove();
		}
		for (i = this.yearInput.selectAll('option:last-child').datum() - 1; i >= minYear; --i)
		{
			this.yearInput.append('option')
				.datum(i)
				.text(i);
		}
		
		this.checkOnYearChanged();
    }
    
	DateInput.prototype._append = function(node, minDate)
	{
		var _this = this;
		var p = d3.select(node);
		
		var row = p.append('div')
			   .classed('date-row', true);
		row.node().dateInput = this;
		
		var yearDiv = row.append('span');
		// yearDiv.append('span').classed('glyphicon glyphicon-triangle-bottom', true);
		this.yearInput = yearDiv.append('select')
			.classed('year', true);
		
		var monthDiv = row.append('span');
		// monthDiv.append('span').classed('glyphicon glyphicon-triangle-bottom', true);
		this.monthInput = monthDiv.append('select').style('display', 'inline')
			.classed('month', true);

		var dateDiv = row.append('span');
		// dateDiv.append('span').classed('glyphicon glyphicon-triangle-bottom', true);
		this.dateInput = dateDiv.append('select').style('display', 'inline')
			.classed('day', true);
	
		var yearNode = this.yearInput.node();
		var monthNode = this.monthInput.node();
		var dateNode = this.dateInput.node();

		var maxYear, minYear;
		maxYear = (new Date()).getUTCFullYear();
	
		if (minDate === undefined)
			minYear = maxYear - 100;
		else
			minYear = minDate.getUTCFullYear();
		
		var years = ['year'];
		for (var i = maxYear; i >= minYear; --i)
			years.push(i);
		this.yearInput.selectAll('option')
			.data(years)
			.enter()
			.append('option')
			.text(function(d) { return d; });
					
		var months = ['month'].concat(Date.CultureInfo.monthNames)
		this.monthInput.selectAll('option')
			.data(months)
			.enter()
			.append('option')
			.text(function(d) { return d; });
	
		var dates = ['(no day)'];
		this.dateInput.selectAll('option')
			.data(dates)
			.enter()
			.append('option')
			.text(function(d) { return d; });
	
		$(yearNode).change(function()
			{
				if (yearNode.selectedIndex == 0)
					_this.year = undefined;
				else
					_this.year = parseInt(yearNode.options[yearNode.selectedIndex].text);
				_this.checkOnYearChanged();
				cr.logRecord('select', 'year: ' + _this.year);
				$(_this).trigger("change");
			});
		
		$(dateNode).change(function()
			{
				_this.day = dateNode.selectedIndex;
				cr.logRecord('select', 'day: ' + _this.day);
				$(_this).trigger("change");
			});
	
		$(monthNode).change(function()
			{
				if (monthNode.selectedIndex == 0)
					_this.month = undefined;
				else
					_this.month = monthNode.selectedIndex;
				_this.checkOnMonthChanged();
				cr.logRecord('select', 'month: ' + _this.month);
				$(_this).trigger("change");
			});
	}
	
	DateInput.prototype.value = function(newValue)
	{
		if (newValue === undefined)
		{
			if (this.year && this.month)
			{
				var m = this.month.toString();
				if (m.length == 1)
					m = "0" + m;
				var t = this.year.toString() + "-" + m;
				if (this.day)
				{
					var d = this.day.toString();
					if (d.length == 1)
						d = "0" + d;
					t += "-" + d;
				}
				return t;
			}
			else if (this.year)
				return this.year.toString();
			else
				return "";
		}
		else
		{
			this.year = parseInt(newValue.substring(0, 4));
			this.yearInput.node().selectedIndex = parseInt(this.yearInput.node().options[1].value) - this.year + 1;
			this.checkOnYearChanged();
			
			this.month = parseInt(newValue.substring(5, 7));
			this.monthInput.node().selectedIndex = this.month;
			this.checkOnMonthChanged();
			
			if (newValue.length > 8)
			{
				this.day = parseInt(newValue.substring(8, 10));
				this.dateInput.node().selectedIndex = this.day;
			}
			else
			{
				this.day = undefined;
				this.dateInput.node().selectedIndex = 0;
			}
			
			return this;
		}
	}
	
	DateInput.prototype.clear = function()
	{
		this.year = undefined;
		this.month = undefined;
		this.day = undefined;
		this.yearInput.node().selectedIndex = 0;
		this.monthInput.node().selectedIndex = 0;
		this.dateInput.node().selectedIndex = 0;
	}
	
	return DateInput;
})();

