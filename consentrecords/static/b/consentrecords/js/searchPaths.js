var SearchPathsPanel = (function () {
	SearchPathsPanel.prototype = new SitePanel();
	SearchPathsPanel.prototype.previousPanel = null;
	
	SearchPathsPanel.prototype.revealInput = function(duration)
	{
		var newTop = $(this.previousPanel).height() 
					 - $(this.searchInput).outerHeight(true)
					 - $(this.topHandle).outerHeight(true);
		
		/* Reset the right margin to the same as the left margin. */
		var inputMarginLeft = parseInt($(this.searchInput).css('margin-left'));
		var inputMarginRight = parseInt($(this.searchInput).css('margin-right'));

		var inputWidth = $(this.searchInput.parentNode).width()
						 - inputMarginLeft + inputMarginRight
						 - $(this.searchInput).outerWidth(true) + $(this.searchInput).outerWidth(false);

		var _this = this;
		$(this.node()).animate({top: newTop,
								height: $(this.topBox).outerHeight(true)},
							   {duration: duration});
		$(this.searchInput).animate({width: inputWidth,
									 "margin-right": inputMarginLeft},
								    {duration: duration,
									 done: function()
										{
											$(_this.searchInput).val('');
											
											/* Hide and show the input so that the placeholder
												re-appears properly in safari 10 and earlier. */
											$(_this.searchInput).hide(0).show(0);
										}
									 });
		$(this.cancelButton).animate({left: inputWidth + (2 * inputMarginLeft),
									  opacity: 0.0},
							   {duration: duration});
	}
	
	SearchPathsPanel.prototype.revealPanel = function(duration)
	{
		
		/* Set the right margin of the search input to 0 and account for this in the inputWidth */
		var parentWidth = $(this.searchInput.parentNode).width();
		var inputMarginLeft = parseInt($(this.searchInput).css('margin-left'));
		var inputMarginRight = parseInt($(this.searchInput).css('margin-right'));
		
		var inputWidth = parentWidth 
						 - $(this.searchInput).outerWidth(true) + $(this.searchInput).outerWidth(false)
						 + inputMarginRight
						 - $(this.cancelButton).outerWidth(true);
						 
		$(this.node()).animate({top: 0,
								height: $(this.node().parentNode).height()},
							   {duration: duration});
		$(this.searchInput).animate({width: inputWidth,
									 "margin-right": 0},
							   {duration: duration});
		$(this.cancelButton).animate({left: inputWidth + inputMarginLeft,
									  opacity: 1.0},
							   {duration: duration});
	}
	
	function SearchPathsPanel(previousPanel)
	{
		this.previousPanel = previousPanel;
		SitePanel.call(this, previousPanel, null, "Search Paths", "search-paths");
		
		var _this = this;
		
		var mainDiv = this.appendScrollArea();
		
		var topBox = mainDiv.append('div');
		this.topBox = topBox.node();
			
		this.topHandle = topBox.append('div')
			.classed('handle', true)
			.node();
			
		this.searchInput = topBox.append('input')
			.attr('placeholder', 'Search for another path')
			.node();
			
		this.cancelButton = topBox.append('button')
			.classed('cancel', true)
			.text('Cancel')
			.node();
			
		$(this.searchInput).focusin(function(event)
			{
				_this.revealPanel();
				event.stopPropagation();
			});
			
			
		$(this.topBox).click(function(event)
			{
				if ($(_this.node()).position().top == 0)
					_this.revealInput();
				else
				{
					$(_this.searchInput).focus();
				}
				event.stopPropagation();
			});
			
		$(this.cancelButton).click(function(event)
			{
				_this.revealInput();
				event.stopPropagation();
			});
			
		function resizeContents()
		{
			if ($(_this.node()).position().top == 0)
				_this.revealPanel(0);
			else
				_this.revealInput(0);
		}
		
		$(mainDiv.node()).on("resize.cr", resizeContents);
		
		setTimeout(function()
			{
				_this.panelDiv.style('top', "{0}px".format($(previousPanel).height()));
				_this.panelDiv.style('display', 'block');
				_this.revealInput();
			});
		
		
	}
	
	return SearchPathsPanel;
})();
