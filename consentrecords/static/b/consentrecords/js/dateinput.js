/* 
	DateInput
	
	This class triggers a change event on itself whenever its year, month or day change.
 */

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
	DateWheel.prototype.didDrag = false;
	
	DateWheel.prototype._yearScrolled = null;
	DateWheel.prototype._monthScrolled = null;
	DateWheel.prototype._dayScrolled = null;
	
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
						var newIndex;
						if (!_this.didDrag)
						{
							if (scrollTop % itemHeight < itemHeight / 2)
								newScrollTop = scrollTop - (scrollTop % itemHeight);
							else
								newScrollTop = scrollTop + itemHeight - (scrollTop % itemHeight);
							newIndex = Math.round(newScrollTop / itemHeight);
						}
						else
						{
							if (scrollTop % itemHeight < itemHeight / 2)
								newIndex = Math.round(scrollTop / itemHeight);
							else
								newIndex = Math.round(scrollTop / itemHeight) + 1;
						}	
						
						if (_this._getIsIndexDisabled(node, newIndex))
						{
							var numItems = $(node).children('li').length;
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
						
						$(node).animate({"scrollTop": newScrollTop}, 200, 'swing', 
							function()
							{
								done.call(this);
							});
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
	
	DateWheel.prototype.selectedMonth = function(value)
	{
		if (value === undefined)
		{
			return this._getSelectedIndex(this.monthNode) + (this.monthRequired ? 1 : 0);
		}
		else
		{	
			this._setSelectedIndex(this.monthNode, value - (this.monthRequired ? 1 : 0));
		}
	}
	
	DateWheel.prototype.disablePreviousMonths = function(minMonth)
	{
		var _this = this;
		var f;
		if (this.monthRequired)
		{
			f = function(d, i)
			{
				_this._setIsDisabled(this, i < minMonth - 1);
			}
		}
		else
		{
			f = function(d, i)
			{
				_this._setIsDisabled(this, i < minMonth && i > 0);
			}
		}
		this.monthPickerList.selectAll('li').each(f);
	}

	DateWheel.prototype._getIsIndexDisabled = function(node, i)
	{
		var li = $(node.childNodes.item(i));
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
    		var minMonth = this.minDate.getUTCMonth() + 1;
    		this.disablePreviousMonths(minMonth);
    		
    		var needToReset = (this.oldMonth < minMonth);
    		if (!this.monthRequired && this.oldMonth == 0)
    			needToReset = false;
    		
    		if (needToReset)
    		{
    			this.oldMonth = minMonth;
    			this.selectedMonth(this.oldMonth);
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
    	else if (this.oldMonth == 0)
    	{
    		this.dayPickerList.selectAll('li').classed('disabled',
    			function(d, i) { return i > 0; });
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
    }
    
    DateWheel.prototype.checkMinDate = function(minDate, maxDate)
    {
    	maxDate = maxDate !== undefined ? maxDate : getUTCTodayDate();
    	
		this.minDate = minDate;
		this.maxDate = maxDate;
		
		var maxYear = (maxDate).getUTCFullYear();
		var minYear = minDate ? minDate.getUTCFullYear() : maxYear - 100;

		this.pauseAlignment();
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
		this.restartAlignment();
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
			if (!m)
			{
				return '{0}'.format(y);
			}
			else
			{
				if (m < 10)
					m = '0{0}'.format(m);
				if (!d)	/* d could be 0 or undefined */
					return '{0}-{1}'.format(y, m);
				else
				{
					if (d < 10)
						d = '0{0}'.format(d);
					return '{0}-{1}-{2}'.format(y, m, d);
				}
			}
		}
		else if (typeof(newValue) != "string")
		{
			throw new Error("Runtime Error: unrecognized data for value: {0}".format(newValue));
		}
		else
		{
			this.isClear = false;
			this.oldYear = parseInt(newValue.substring(0, 4));
			this._setSelectedIndex(this.yearNode, 
				this._getMaxYear() - this.oldYear);
			this._onYearChanged();
			
			this.oldMonth = parseInt(newValue.substring(5, 7));
			this.selectedMonth(this.oldMonth);
			
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
			this._onMonthChanged();
			$(this).trigger('change');
			
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
	
	DateWheel.prototype.onShowing = function()
	{
		this._setSelectedIndex(this.yearNode, 
			this._getMaxYear() - this.oldYear);
		this.selectedMonth(this.oldMonth);
		this._setSelectedIndex(this.dayNode, this.oldDay);
		
		this.restartAlignment();
	}
	
	DateWheel.prototype.restartAlignment = function()
	{
		/* Set up scrolling in a timeout after the scrolling caused by the
			above code is handled. 
		 */
		var _this = this;
		setTimeout(function()
			{
				$(_this.yearNode).on('scroll', _this._yearScrolled);
				$(_this.monthNode).on('scroll', _this._monthScrolled);
				$(_this.dayNode).on('scroll', _this._dayScrolled);
			});
	}
	
	DateWheel.prototype.pauseAlignment = function()
	{
		$(this.yearNode).off('scroll', this._yearScrolled);
		$(this.monthNode).off('scroll', this._monthScrolled);
		$(this.dayNode).off('scroll', this._dayScrolled);
	}
	
	DateWheel.prototype.onHiding = function()
	{
		this.pauseAlignment();
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
    
    DateWheel.prototype._setupDrag = function(node)
    {
		var offsetY;
		var _this = this;
		d3.select(node).attr('draggable', 'true')
			.call(
				d3.behavior.drag()
					.on("dragstart", function(){
						try
						{
							var offset = d3.mouse(this);
							offsetY = offset[1];
							startScrollTop = $(this).scrollTop();
							_this.didDrag = false;
						}
						catch(err)
						{
							console.log(err);
						}
					})
					.on("drag", function(){
						_this.didDrag = true;
						$(this).scrollTop(startScrollTop + offsetY - d3.mouse(this)[1]);
					})
					.on("dragend", function(fd, i){
						if (_this.didDrag)
						{
							_this.didDrag = false;
							/* Set isClear to false here so that scrolling always
								leads to item being selected. */
							_this.isClear = false;
							$(this).scroll();
						}
					})
				);
    }
    
	function DateWheel(container, showDate, minDate, maxDate, monthRequired)
	{
		console.assert(container);
		console.assert(showDate);
		console.assert(typeof(showDate) == "function");
    		
    	maxDate = maxDate !== undefined ? maxDate : getUTCTodayDate();
    		
		var _this = this;
		this.showDate = showDate;
		this.isClear = false;
		this.monthRequired = monthRequired;

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
		
		function unClear()
		{
			if (_this.isClear)
			{
				_this.isClear = false;
				_this.onChange();
				$(_this).trigger('change');
			}
		}
		
		this._setupDrag(this.yearNode);	
		this._setupDrag(this.monthNode);	
		this._setupDrag(this.dayNode);
		this._yearScrolled = this._getAlignmentFunction(function()
			{
				/* Test to make sure this is displayed, because in Firefox, the scroll event occurs
					after this item is undisplayed.
				 */
				if ($(this).css('display') != 'none')
				{
					var newYear = _this._getMaxYear() - _this._getSelectedIndex(_this.yearNode);
					if (newYear != _this.oldYear)
					{
						_this.isClear = false;
						_this.oldYear = newYear;
						_this._onYearChanged();
						$(_this).trigger('change');
					}
				}
			});
		this._monthScrolled = this._getAlignmentFunction(function() 
			{ 
				/* Test to make sure this is displayed, because in Firefox, the scroll event occurs
					after this item is undisplayed.
				 */
				if ($(this).css('display') != 'none')
				{
					var newMonth = _this.selectedMonth();
					if (newMonth != _this.oldMonth)
					{
						_this.isClear = false;
						_this.oldMonth = newMonth;
						_this._onMonthChanged();
						$(_this).trigger('change');
					}
				}
			});
		
		this._dayScrolled = this._getAlignmentFunction(function()
			{ 
				/* Test to make sure this is displayed, because in Firefox, the scroll event occurs
					after this item is undisplayed.
				 */
				if ($(this).css('display') != 'none')
				{
					var newDay = _this._getSelectedIndex(_this.dayNode);
					if (_this.oldDay != newDay)
					{
						_this.isClear = false;
						_this.oldDay = newDay;
						_this.onChange(); 
						$(_this).trigger('change');
					}
				}
			});
		$(this.yearNode).click(unClear);
		$(this.monthNode).click(unClear);
		$(this.dayNode).click(unClear);
				
		var months = Date.CultureInfo.monthNames;
		if (!monthRequired)
		{
			months = ['(no month)'].concat(months);
		}
		
		this.monthPickerList.selectAll('li')
			.data(months)
			.enter()
			.append('li')
			.text(function(d) { return d; });
			
		/* Set the default date to a reasonable value. */
		var currentDate = getUTCTodayDate();
		if (currentDate > maxDate)
			currentDate = maxDate;
		else if (currentDate < minDate)
			currentDate = minDate;
		
		/* Initialize oldYear, oldMonth and oldDay to reasonable values */
		this.oldYear = currentDate.getUTCFullYear();
		if (monthRequired)
			this.oldMonth = currentDate.getUTCMonth() + 1;
		else
			this.oldMonth = 0;	/* no month */
		this.oldDay = 0;	/* no day */
	}
	
	return DateWheel;
})();
