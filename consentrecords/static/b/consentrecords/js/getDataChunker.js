
/* Used to chunk getData operations. */
var GetDataChunker = (function() {
	GetDataChunker.prototype.path = null;
	GetDataChunker.prototype.fields = [];
	GetDataChunker.prototype.resultType = null;
	GetDataChunker.prototype._increment = 20;
	GetDataChunker.prototype._containerNode = null;
	GetDataChunker.prototype._loadingMessage = null;
	GetDataChunker.prototype._isSpinning = null;
	GetDataChunker.prototype._start = 0;
	GetDataChunker.prototype._searchCount = 0;
	GetDataChunker.prototype._curSearchID = 0;
	GetDataChunker.prototype._onFoundInstances = null;
	GetDataChunker.prototype._onDoneSearch = null;
	GetDataChunker.prototype._check = null;
	
	GetDataChunker.prototype.invalidatePendingData = function()
	{
		this._curSearchID = 0;
	}
	
	GetDataChunker.prototype._scrollingNode = function()
	{
		if ($(this._containerNode).css('overflow-y') == 'scroll')
			return $(this._containerNode);
		else
			return $(this._containerNode).scrollParent();
	}
	
	GetDataChunker.prototype._clearScrollCheck = function()
	{
		if (this._check != null)
		{
			this._scrollingNode().off("scroll resize.cr", this._check);
			this._check = null;
		}
		this.invalidatePendingData();
		this._start = 0;
	}
	
	GetDataChunker.prototype.clearLoadingMessage = function()
	{
		if (this._loadingMessage != null)
		{
			crv.stopLoadingMessage(this._loadingMessage);
			this._loadingMessage.remove();
			this._loadingMessage = null;
			this._isSpinning = false;
		}
		this._clearScrollCheck();
	}
	
	GetDataChunker.prototype.increment = function(newValue)
	{
		if (newValue === undefined)
			return this._increment;
		else
		{
			this._increment = newValue;
			return this;
		}
	}
	
	GetDataChunker.prototype._restart = function(instances, startVal)
	{
		if (!this._loadingMessage)
			throw "loadingMessage is not set up";
			
		if (instances.length < this.increment())
		{
			this.clearLoadingMessage();
			if (this._onDoneSearch)
				this._onDoneSearch();
		}
		else
		{
			this._start += this.increment();
			if (!this.isOverflowingY(this._loadingMessage.node()))
				this._continue(startVal);
			else
				this.invalidatePendingData();
		}
	}
	
	GetDataChunker.prototype.showLoadingMessage = function()
	{
		if (this._loadingMessage == null)
		{
			this._loadingMessage = crv.appendLoadingMessage(this._containerNode);
			this._isSpinning = true;
		}
		else if (!this._isSpinning)
		{
			crv.startLoadingMessage(this._loadingMessage);
			this._isSpinning = true;
		}
	}
	
	GetDataChunker.prototype._continue = function(startVal)
	{
		var _this = this;
		if (!this.path)
			throw ("path is not specified to GetDataChunker._continue");
		
		this.showLoadingMessage();
		
		this._searchCount += 1;
		var curSearchCount = this._searchCount;
		this._curSearchID = this._searchCount;

		cr.getData({path: this.path, 
		            resultType: this.resultType,
					start: this._start,
					end: this._start + this.increment(),
					fields: this.fields})
			.then(function(instances) 
						{ 
							/* this._curSearchID is set to 0 if the scrollCheck is cleared, which occurs when
								this is destroyed. If it is destroyed, there may be an asynchronous call hanging out,
								which is handled here.
							 */
							if (_this._curSearchID == curSearchCount)
							{
								if (_this._onFoundInstances(instances, startVal))
									_this._restart(instances, startVal);
							}
						},
					cr.asyncFail);
	}
	
	GetDataChunker.prototype._setScrollCheck = function(startVal)
	{
		var _this = this;
		
		this._clearScrollCheck();

		this._check = function(eventObject)
		{
			_this._onScroll(eventObject.data);
		}
		
		var scrollingNode = this._scrollingNode();
		if (scrollingNode.length == 0)
			throw new Error("scrollParent not specified; containerNode is not displayed");
			
		scrollingNode.scroll(startVal, this._check)
					 .on("resize.cr", this._check);
	}
	
	/* checkStart is called to start up a new search that is going to append its results
		to the current search results.
	 */
	GetDataChunker.prototype.checkStart = function(startVal)
	{
		if (!this.path)
			return;
			
		this._setScrollCheck(startVal);
		this.showLoadingMessage();
		this._onScroll(startVal);
	}
	
	GetDataChunker.prototype.start = function(startVal)
	{
		this._setScrollCheck(startVal);
		this._continue(startVal);
	}
	
	GetDataChunker.prototype.isOverflowingY = function(node)
	{
		var $p = $(node).scrollParent();
		return node.offsetTop > $p.scrollTop() + $p.height();
	}
	
	GetDataChunker.prototype._onScroll = function(startVal)
	{
		/* On a scroll event, if there is a loadingMessage and the path has
		    been specified and we aren't already in a getData, then
		    check to see if the loading message is visible. If it is, then
		    start the search.
		    
		    The loadingMessage may be set in a separate event than the path being set.
		    For example, in SearchView, the loadingMessage appears and then there is
		    a short gap for the user to type. In that gap, there is no path and 
		    we shouldn't continue.
		 */
		if (this._loadingMessage != null && this.path && this._curSearchID == 0)
		{
			if (!this.isOverflowingY(this._loadingMessage.node()))
				this._continue(startVal);
		}
	}
	
	GetDataChunker.prototype._appendNode = function(elementType)
	{
		var t = document.createElement(elementType);
		if (this._loadingMessage)
    		this._containerNode.insertBefore(t, this._loadingMessage.node());
    	else
    		this._containerNode.appendChild(t);
    	return t;
	}

	GetDataChunker.prototype.appendButtonContainers = function(data)
	{
		var _this = this;
		
		/* Ensure that the container is visible, so that the new items will also appear. */
		$(this._containerNode).css("display", "");
		
		var items = data.map(function(d) {
			var i = _this._appendNode('li');
			d3.select(i).datum(d);
			return i;
		});
		return d3.selectAll(items);
	}
	
	GetDataChunker.prototype.hasShortResults = function()
	{
		return this.buttons().size() < this.increment() &&
			   this._curSearchID == 0 &&
			   !this._isSpinning;
	}
	
	GetDataChunker.prototype.hasButtons = function()
	{
		return this.buttons().size() > 0;
	}
	
	GetDataChunker.prototype.buttons = function()
	{
		return d3.select(this._containerNode).selectAll('li');
	}
	
	function GetDataChunker(containerNode, onFoundInstances, onDoneSearch)
	{
		this._containerNode = containerNode;
		this._loadingMessage = null;
		this._isSpinning = false;
		this.path = null;
		this._start = 0;
		this._curSearchID = 0;
		this._onFoundInstances = onFoundInstances;
		this._onDoneSearch = onDoneSearch;
		this._check = null;
		
		var _this = this;
		$(this._containerNode).on("remove", function()
			{
				_this.invalidatePendingData();
			});
	}
	
	return GetDataChunker;
})();
