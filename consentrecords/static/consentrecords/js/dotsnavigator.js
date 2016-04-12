/* DotsNavigator is a class that Dots are followed by a set of panels, which can have the following functions:
	onReveal: called each time the panel is revealed. Typically this is used
			  to initialize the panel contents and then set to either null or a 
			  different function for subsequent reveals.
	onGoingForward: called when the panel is completed and the user clicks the 
			  Next or Add button.
	onCheckForwardEnabled: called to determine whether or not the go forward button
			  is enabled for each panel.
 */
	
var DotsNavigator = (function () {
	DotsNavigator.prototype.div = null;
	DotsNavigator.prototype.panels = null;
	DotsNavigator.prototype.doneButton = null;
	DotsNavigator.prototype.backButton = null;
	DotsNavigator.prototype.count = 0;
	DotsNavigator.prototype.value = 0;
	DotsNavigator.prototype.done = null;
	DotsNavigator.prototype.cancel = null;
	DotsNavigator.prototype.finalText = "Add";
	DotsNavigator.prototype.services = [];
	DotsNavigator.prototype.datum = null;
	
	DotsNavigator.prototype.setValue = function(newValue) {
		var oldValue = this.value;
	
		var p = this.nthPanel(oldValue);
		if (p.onDoneClicked)
			p.onDoneClicked();
		
		this.value = newValue;
		var li = this.div.selectAll("ol > li");
		li.classed("active", function(d, i) { return i == newValue; });
	
		if (newValue > 0)
			this.backButton.selectAll("span").text("Back");
		else
			this.backButton.selectAll("span").text("Cancel");
	
		if (newValue < this.count - 1)
			this.doneButton.selectAll("span").text("Next");
		else
			this.doneButton.selectAll("span").text(this.finalText);
		
		p = this.nthPanel(newValue);
		if (p.onReveal)
			p.onReveal.call(p, this.datum);
			
		this.checkForwardEnabled();
	
		var containerWidth = $(this.div.node()).parent().width();
	
		if (oldValue < newValue)
		{
			while (oldValue < newValue)
			{
				var p = $(this.nthPanel(oldValue));
				p.animate({left: -containerWidth}, 700, "swing");
				++oldValue;
			}
			$(this.nthPanel(newValue))
				.animate({left: 0}, 700, "swing");
		}
		else if (oldValue > newValue)
		{
			while (oldValue > newValue)
			{
				var p = $(this.nthPanel(oldValue));
				p.animate({left: containerWidth}, 700, "swing");
				--oldValue;
			}
			$(this.nthPanel(newValue))
				.animate({left: 0}, 700, "swing");
		}
		unblockClick();
	}

	DotsNavigator.prototype.nthPanel = function(n) {
		return this.panels[0][n];
	}
	
	DotsNavigator.prototype.showDots = function() {
		p = this.nthPanel(0);
		p.onReveal.call(p, this.datum);
		this.checkForwardEnabled();
	}
	
	DotsNavigator.prototype.goBack = function()
	{
		var _this = this;
		var goToPrevious = function()
		{
			if (_this.value > 0)
				_this.setValue(_this.value - 1);
			else
				_this.cancel();
		}
		
		if (prepareClick('click', this.backButton.selectAll('span').text()))
		{
			showClickFeedback(this.backButton.node());
			var p = this.nthPanel(this.value);
			if (p.onGoingBack)
				p.onGoingBack(goToPrevious);
			else
				goToPrevious();
		}
	}
	
	DotsNavigator.prototype.appendBackButton = function(navContainer, cancel)
	{
		var _this = this;
		this.cancel = cancel;
		this.backButton = navContainer.appendLeftButton()
			.on("click", function()
			{
				_this.goBack();
				d3.event.preventDefault();
			});
		this.backButton.append("span").text("Cancel");
	}
	
	DotsNavigator.prototype.goForward = function()
	{
		var _this = this;
		var gotoNext = function()
		{
			if (_this.value == _this.count - 1)
				_this.done();
			else
				_this.setValue(_this.value + 1);
		}
		if (prepareClick('click', this.doneButton.selectAll('span').text()))
		{
			if (this.isForwardEnabled())
			{
				showClickFeedback(this.doneButton.node());
			
				var p = this.nthPanel(this.value);
				if (p.onGoingForward)
					p.onGoingForward(gotoNext);
				else
					gotoNext();
			}
			else
				unblockClick();
		}
	}
	
	DotsNavigator.prototype.appendForwardButton = function(navContainer, done)
	{
		var _this = this;
		this.done = done;
		
		this.doneButton = navContainer.appendRightButton()
			.on("click", function(d) {
				_this.goForward();
				d3.event.preventDefault();
			});
		this.doneButton.append("span").text("Next");
	}
	
	DotsNavigator.prototype.isForwardEnabled = function()
	{
		var p = this.nthPanel(this.value);
		return (p.onCheckForwardEnabled === undefined ||
						 p.onCheckForwardEnabled());
	}
	
	/* This method is called from within a panel when its content changes to determine
		whether or not the go forward button is enabled. A panel that calls this method
		should define a onCheckForwardEnabled function. 
	 */
	DotsNavigator.prototype.checkForwardEnabled = function()
	{
		var isEnabled = this.isForwardEnabled();
		this.doneButton
			.classed("site-disabled-text", !isEnabled)
			.classed("site-active-text", isEnabled);
	}
	
	function DotsNavigator(panel2Div, numDots) {
		/* By default, the data is the dots object itself for backward compatibility.
		 */
		this.datum = this;
		
		var dotIndexes = [];
		for (var i = 0; i < numDots; i++)
			dotIndexes.push(i);
	
		this.div = panel2Div.append('div')
			.classed('dots', true);
		var ol = this.div.append('div').append('ol');

		var li = ol.selectAll('li')
			.data(dotIndexes)
			.enter()
			.append('li')
			.classed("active", function(d, i) { return i == 0; });
			
		this.panels = panel2Div.selectAll('panel')
			.data(dotIndexes)
			.enter()
			.append('panel');

		this.count = numDots;
		this.value = 0;
	
		this.services = [];
		this.doneButton = null;
		this.backButton = null;
	
		var _this = this;
		function layoutPanels()
		{
			var containerWidth = $(_this.div.node()).parent().width();
			_this.panels.each(function(d, i)
			{
				if (i < _this.value)
					$(this).offset({left: -containerWidth});
				else if (i == _this.value)
					$(this).offset({left: 0});
				else
					$(this).offset({left: containerWidth});
			});
		}
	
		$(panel2Div.node()).on("resize.cr", layoutPanels);
	}
	
	return DotsNavigator;
})();

