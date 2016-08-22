/* 
	DateInput
	
	This class triggers a change event on itself whenever its year, month or day change.
 */

var DateInput = (function () {
	DateInput.prototype.year = undefined;
	DateInput.prototype.month = undefined;
	DateInput.prototype.day = undefined;
	DateInput.prototype.minDate = undefined;
	DateInput.prototype.maxDate = undefined;
	DateInput.prototype.yearInput = null;
	DateInput.prototype.monthInput = null;
	DateInput.prototype.dateInput = null;
	
    function DateInput(node, minDate, maxDate) {
    	if (!node)
    		throw ("node is not specified");
    		
    	maxDate = maxDate !== undefined ? maxDate : new Date();
    		
    	this.year = undefined;
    	this.month = undefined;
    	this.day = undefined;
    	this.minDate = minDate;
    	this.maxDate = maxDate;
    	
    	this.yearInput = null;
    	this.monthInput = null;
    	this.dateInput = null;
    	
    	this._append(node, minDate, maxDate);
    };
    
    DateInput.prototype.checkOnYearChanged = function()
    {
    	this.yearInput.selectAll('option').each(function(d, i)
    		{
    			if (d == 'year')
    				d3.select(this).attr('disabled', true);
    		});
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
    			$(this.monthInput.node()).trigger("change");
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
    			$(this.dateInput.node()).trigger('change');
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
		{
			this.dateInput.node().selectedIndex = oldDate;
			$(this.dateInput.node()).trigger('change');
		}
    }
    
    DateInput.prototype.appendUnspecifiedYear = function()
    {
		this.yearInput.append('option')
			.datum('year')
			.text('year');
		if (this.year === undefined)
			this.yearInput.node().selectedIndex = this.yearInput.selectAll('option').size() - 1;
    }
    
    DateInput.prototype.checkMinDate = function(minDate, maxDate)
    {
    	maxDate = maxDate !== undefined ? maxDate : new Date();
    	
		var yearNode = this.yearInput.node();
		var monthNode = this.monthInput.node();
		var dateNode = this.dateInput.node();

		var maxYear, minYear;
		maxYear = (maxDate).getUTCFullYear();
		var thisDate = new Date();
		var thisYear = thisDate.getUTCFullYear();
	
		this.minDate = minDate;
		this.maxDate = maxDate;
		
		if (minDate === undefined)
			minYear = maxYear - 100;
		else
			minYear = minDate.getUTCFullYear();

		var newNumOptions = maxYear - minYear + 2;
		if (this.year)
		{
			if (this.year < minYear)
				this.year = minYear;
			if (this.year > maxYear)
				this.year = maxYear;
		}
		
		this.yearInput.selectAll('option').remove();
		if (maxYear < thisYear)
		{
			this.yearInput.append('option')
				.datum('year')
				.text('year');
			if (this.year === undefined)
				this.yearInput.node().selectedIndex = 0;
		}
		
		for (i = maxYear; i >= minYear; --i)
		{
			if (i == thisYear && this.minDate < thisDate)
			{
				this.appendUnspecifiedYear();
			}
			
			this.yearInput.append('option')
				.datum(i)
				.text(i);
			if (this.year == i)
				this.yearInput.node().selectedIndex = this.yearInput.selectAll('option').size() - 1;

			if (i == thisYear && this.minDate >= thisDate)
			{
				this.appendUnspecifiedYear();
			}
		}
		
		if (minYear > thisYear)
		{
			this.yearInput.append('option')
				.datum('year')
				.text('year');
			if (this.year === undefined)
				this.yearInput.node().selectedIndex = this.yearInput.selectAll('option').size() - 1;
		}
		
		this.checkOnYearChanged();
    }
    
	DateInput.prototype._append = function(node, minDate, maxDate)
	{
		var _this = this;
		var p = d3.select(node);
		
		var row = p.append('div')
			   .classed('date-row', true);
		row.node().dateInput = this;
		
		var yearDiv = row.append('span');
		this.yearInput = yearDiv.append('select')
			.classed('year site-active-text', true);
		
		var monthDiv = row.append('span');
		this.monthInput = monthDiv.append('select').style('display', 'inline')
			.classed('month site-active-text', true);

		var dateDiv = row.append('span');
		this.dateInput = dateDiv.append('select').style('display', 'inline')
			.classed('day site-active-text', true);
	
		var yearNode = this.yearInput.node();
		var monthNode = this.monthInput.node();
		var dateNode = this.dateInput.node();

		var maxYear, minYear;
		if (maxDate === undefined)
			maxYear = (new Date()).getUTCFullYear();
		else
			maxYear = maxDate.getUTCFullYear();
	
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
		var _this = this;
		this.yearInput.selectAll('option').each(function(d, i)
			{
				if (d === 'year')
					_this.yearInput.node().selectedIndex = i;
			});
		this.monthInput.node().selectedIndex = 0;
		this.dateInput.node().selectedIndex = 0;
	}
	
	return DateInput;
})();

var DateWheel = (function () {
	DateWheel.prototype._node = null;
	DateWheel.prototype.monthPickerList = null;
	DateWheel.prototype.yearPickerList = null;
	DateWheel.prototype.dayPickerList = null;
	DateWheel.prototype.yearNode = null;
	DateWheel.prototype.monthNode = null;
	DateWheel.prototype.dayNode = null;
	
	DateWheel.prototype.showDate = null;
	
	DateWheel.prototype.oldYear = 0;
	DateWheel.prototype.oldMonth = 0;
	DateWheel.prototype.oldDay = 0;
	DateWheel.prototype.minDate = null;
	DateWheel.prototype.maxDate = null;
	DateWheel.prototype.isClear = false;
	
	DateWheel.prototype._getAlignmentFunction = function(done)
	{
		var timeout = null;
		var _this = this;
		return function()
			{
				clearTimeout(timeout);
				var node = this;
				timeout = setTimeout(function()
					{
						var itemHeight = Math.round($(node).children('li:first-child').outerHeight(false));
						var scrollTop =  Math.round($(node).scrollTop());
						
						var newScrollTop;
						if (scrollTop % itemHeight < itemHeight / 2)
							newScrollTop = scrollTop - (scrollTop % itemHeight);
						else
							newScrollTop = scrollTop + itemHeight - (scrollTop % itemHeight);
							
						var newIndex = Math.round(newScrollTop / itemHeight);
						if (_this._getIsIndexDisabled(node, newIndex))
						{
							var numItems = $(node).children('li').size();
							while (newIndex < numItems)
							{
								if (!_this._getIsIndexDisabled(node, newIndex))
									break;
								++newIndex;
							}
							if (newIndex == numItems)
							{
								for (newIndex = Math.round(newScrollTop / itemHeight);
									 newIndex >= 0;
									 --newIndex)
								{
									if (!_this._getIsIndexDisabled(node, newIndex))
										break;
								}
							}
							newScrollTop = itemHeight * newIndex;
						}
						
						$(node).animate({"scrollTop": newScrollTop}, 200, 'swing', done);
					}, 110);
			}
	}
	
	DateWheel.prototype._getSelectedIndex = function(node)
	{
		var itemHeight = Math.round($(node).children('li:first-child').outerHeight(false));
		return Math.round($(node).scrollTop() / itemHeight);
	}
	
	DateWheel.prototype._setSelectedIndex = function(node, value)
	{
		var itemHeight = Math.round($(node).children('li:first-child').outerHeight(false));
		$(node).scrollTop(value * itemHeight);
	}
	
	DateWheel.prototype._getIsIndexDisabled = function(node, i)
	{
		var li = $(node).children('li:nth-child({0})'.format(i+1));
		return li.hasClass('disabled');
	}
	
	DateWheel.prototype._setIsDisabled = function(node, value)
	{
		d3.select(node).classed('disabled', value);
	}
	
    DateWheel.prototype._getMaxYear = function()
    {
    	return this.yearPickerList.selectAll('li').data()[0];
    }
    
    DateWheel.prototype._onYearChanged = function()
    {
    	var _this = this;
    	if (this.minDate && this.oldYear == this.minDate.getUTCFullYear())
    	{
    		minMonth = this.minDate.getUTCMonth();
    		this.monthPickerList.selectAll('li').each(function(d, i)
    			{
    				_this._setIsDisabled(this, i < minMonth);
    			});
    		if (this.oldMonth < minMonth + 1)
    		{
    			this.oldMonth = minMonth + 1;
    			this._setSelectedIndex(this.monthNode, minMonth);
    		}
    	}
    	else
    	{
    		this.monthPickerList.selectAll('li').classed('disabled', false);
    	}
    	
    	this._onMonthChanged();
	}
    
    DateWheel.prototype._onMonthChanged = function()
    {
		dates = ['(no day)'];
		var daysInMonth = 31;	/* A dummy value for the moment. */
    	if (this.oldYear && this.oldMonth)
    	{
			this.dayPickerList.selectAll('li').remove();
			daysInMonth = (new Date(this.oldYear, this.oldMonth, 0)).getDate();
			for (var i = 1; i <= daysInMonth; ++i)
				dates.push(i);
		}
		
		this.dayPickerList.selectAll('li').remove();
		this.dayPickerList.selectAll('li')
			.data(dates)
			.enter()
			.append('li')
			.text(function(d) { return d; });

		var _this = this;
    	if (this.minDate && 
    		this.oldYear == this.minDate.getUTCFullYear() &&
    		this.oldMonth == this.minDate.getUTCMonth()+1)
    	{
    		minDay = this.minDate.getUTCDate();
    		this.dayPickerList.selectAll('li').each(function(d, i)
    			{
    				_this._setIsDisabled(this, i > 0 && i < minDay);
    			});
    		if (this.oldDay > 0 && this.oldDay < minDay)
    		{
    			this.oldDay = minDay;
    		}
    	}
    	else
    	{
    		this.dayPickerList.selectAll('li').classed('disabled', false);
    	}

		if (this.oldDay > 0 && this.oldDay <= daysInMonth)
		{
			this._setSelectedIndex(this.dayNode, this.oldDay);
		}
		
		this.onChange();
		$(this).trigger('change');
    }
    
    DateWheel.prototype.checkMinDate = function(minDate, maxDate)
    {
		this.minDate = minDate;
		this.maxDate = maxDate;
		
    	maxDate = maxDate !== undefined ? maxDate : getUTCTodayDate();
    	
		var maxYear = (maxDate).getUTCFullYear();
		var minYear = minDate ? minDate.getUTCFullYear() : maxYear - 100;

		if (this.oldYear)
		{
			if (this.oldYear < minYear)
			{
				this.oldYear = minYear;
				this.oldDay = 0;
				this._setSelectedIndex(this.dayNode, 0);
			}
			if (this.oldYear > maxYear)
			{
				this.oldYear = maxYear;
				this.oldDay = 0;
				this._setSelectedIndex(this.dayNode, 0);
			}
		}
		
		this.yearPickerList.selectAll('li').remove();
		for (var i = maxYear, j = 0; i >= minYear; --i, ++j)
		{
			this.yearPickerList.append('li')
				.datum(i)
				.text(i);
			if (this.oldYear == i)
			{
				this._setSelectedIndex(this.yearNode, j);
			}
		}
				
		this._onYearChanged();
    }
    
	DateWheel.prototype.value = function(newValue)
	{
		if (newValue === undefined)
		{
			if (this.isClear)
				return '';
			
			var m = this.oldMonth;
			var y = this.oldYear;
			var d = this.oldDay;
			if (m < 10)
				m = "0{0}".format(m);
			if (!d)	/* d could be 0 or undefined */
				return "{0}-{1}".format(y, m);
			else
			{
				if (d < 10)
					d = "0{0}".format(d);
				return "{0}-{1}-{2}".format(y, m, d);
			}
		}
		else if (typeof(newValue) != "string")
		{
			throw ("Runtime Error: unrecognized data for value: {0}".format(newValue));
		}
		else
		{
			this.isClear = false;
			this.oldYear = parseInt(newValue.substring(0, 4));
			this._setSelectedIndex(this.yearNode, 
				this._getMaxYear() - this.oldYear);
			this._onYearChanged();
			
			this.oldMonth = parseInt(newValue.substring(5, 7));
			this._setSelectedIndex(this.monthNode, this.oldMonth - 1);
			this._onMonthChanged();
			
			if (newValue.length > 8)
			{
				this.oldDay = parseInt(newValue.substring(8, 10));
				this._setSelectedIndex(this.dayNode, this.oldDay);
			}
			else
			{
				this.oldDay = undefined;
				this._setSelectedIndex(this.dayNode, 0);
			}
			
			return this;
		}
	}
	
	/* Mark the dateWheel as clear so that requests for its date are blank.
	   This assumes that the date has already been backed up. */
	DateWheel.prototype.clear = function()
	{
		
		this.isClear = true;
		this.showDate('');
	}
	
	DateWheel.prototype.unclear = function()
	{
		this.isClear = false;
	}
	
	DateWheel.prototype.restoreDate = function()
	{
		this._setSelectedIndex(this.yearNode, 
			this._getMaxYear() - this.oldYear);
		this._setSelectedIndex(this.monthNode, this.oldMonth - 1);
		this._setSelectedIndex(this.dayNode, this.oldDay);
	}
	
    DateWheel.prototype.onChange = function()
    {
		this.showDate(this.value());
    }
    
    /* Returns the top level DOM element that contains this dateWheel */
    DateWheel.prototype.node = function()
    {
    	return this._node;
    }
    
	function DateWheel(container, showDate, minDate, maxDate)
	{
    	if (!container)
    		throw ("container is not specified");
    	if (!showDate)
    		throw ("showDate is not specified");
    	if (typeof(showDate) != "function")
    		throw ("showDate is not a function");
    		
    	maxDate = maxDate !== undefined ? maxDate : getUTCTodayDate();
    		
		var _this = this;
		this.showDate = showDate;
		this.isClear = false;

		var d3Container = d3.select(container);
		var datePickerContainer = d3Container.append('div')
			.classed('wheel', true);
		this._node = datePickerContainer.node();
		this.yearPickerList = datePickerContainer.append('ol');
		this.monthPickerList = datePickerContainer.append('ol');
		this.dayPickerList = datePickerContainer.append('ol');
		this.yearNode = this.yearPickerList.node();
		this.monthNode = this.monthPickerList.node();
		this.dayNode = this.dayPickerList.node();
		
		var topShade = datePickerContainer.append('div')
			.classed('topShade', true);
		var bottomShade = datePickerContainer.append('div')
			.classed('bottomShade', true);
		
		$(this.yearNode).scroll(this._getAlignmentFunction(function()
			{ 
				_this.oldYear = _this._getMaxYear() - _this._getSelectedIndex(_this.yearNode);
				_this._onYearChanged();
				$(_this).trigger('change');
			}));
		$(this.monthNode).scroll(this._getAlignmentFunction(function() 
			{ 
				_this.oldMonth = _this._getSelectedIndex(_this.monthNode) + 1;
				_this._onMonthChanged();
				$(_this).trigger('change');
			}));
		$(this.dayNode).scroll(this._getAlignmentFunction(function()
			{ 
				_this.oldDay = _this._getSelectedIndex(_this.dayNode);
				_this.onChange(); 
				$(_this).trigger('change');
			}));
		
		var months = Date.CultureInfo.monthNames;
		this.monthPickerList.selectAll('li')
			.data(months)
			.enter()
			.append('li')
			.text(function(d) { return d; });
			
		this.checkMinDate(minDate, maxDate);
		
		/* Initialize oldYear, oldMonth and oldDay to reasonable values */
		_this.oldYear = _this._getMaxYear() - _this._getSelectedIndex(_this.yearNode);
		_this.oldMonth = _this._getSelectedIndex(_this.monthNode) + 1;
		_this.oldDay = _this._getSelectedIndex(_this.dayNode);
	}
	
	return DateWheel;
})();
