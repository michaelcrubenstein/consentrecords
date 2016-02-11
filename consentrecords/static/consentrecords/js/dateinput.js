/* 
	DateInput
	
	This class triggers a change event on itself whenever its year, month or day change.
 */

var DateInput = (function () {
	DateInput.prototype.year = undefined;
	DateInput.prototype.month = undefined;
	DateInput.prototype.day = undefined;
	DateInput.prototype.yearInput = null;
	DateInput.prototype.monthInput = null;
	DateInput.prototype.dateInput = null;
	
    function DateInput(node, minYear) {
    	this.year = undefined;
    	this.month = undefined;
    	this.day = undefined;
    	
    	this.yearInput = null;
    	this.monthInput = null;
    	this.dateInput = null;
    	
    	if (node !== undefined)
    	{
    		this.append(node, minYear);
    	}
    };
    
    DateInput.prototype.checkOnYearChanged = function()
    {
    	this.yearInput.selectAll(":first-child").attr('disabled', true);
	}
    
    DateInput.prototype.checkOnMonthChanged = function()
    {
		this.monthInput.selectAll(":first-child").attr('disabled', true);
		var oldDate = this.dateInput.node().selectedIndex;
		this.dateInput.selectAll('option').remove();
		var selectedYear = parseInt(this.yearInput.node().options[this.yearInput.node().selectedIndex].text);
		var selectedMonth = this.monthInput.node().selectedIndex;
		var daysInMonth = (new Date(selectedYear, selectedMonth, 0)).getDate();
		dates = ['(no day)'];
		for (var i = 1; i <= daysInMonth; ++i)
			dates.push(i);
		this.dateInput.selectAll('option').remove();
		this.dateInput.selectAll('option')
			.data(dates)
			.enter()
			.append('option')
			.text(function(d) { return d; });
		if (oldDate > 0 && oldDate <= daysInMonth)
			this.dateInput.node().selectedIndex = oldDate;
    }
    
	DateInput.prototype.append = function(node, minYear)
	{
		var _this = this;
		var p = d3.select(node);
		
		var row = p.append('div')
			   .classed('date-row', true);
		row.node().dateInput = this;
		
		var yearDiv = row.append('div');
		yearDiv.append('span').classed('glyphicon glyphicon-triangle-bottom', true);
		this.yearInput = yearDiv.append('select')
			.classed('year', true);
		
		var monthDiv = row.append('div');
		monthDiv.append('span').classed('glyphicon glyphicon-triangle-bottom', true);
		this.monthInput = monthDiv.append('select').style('display', 'inline')
			.classed('month', true);

		var dateDiv = row.append('div');
		dateDiv.append('span').classed('glyphicon glyphicon-triangle-bottom', true);
		this.dateInput = dateDiv.append('select').style('display', 'inline')
			.classed('day', true);
	
		var yearNode = this.yearInput.node();
		var monthNode = this.monthInput.node();
		var dateNode = this.dateInput.node();

		var maxYear;
		maxYear = (new Date()).getFullYear();
	
		if (minYear === undefined)
			minYear = maxYear - 100;
		
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
	
	return DateInput;
})();

