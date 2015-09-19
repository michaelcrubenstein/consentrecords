/* Workds with bodybackground.css to ensure a single smooth gradient across the body 
 * of an html page.
 */
 
/* Make the body equal to the inner height of the window so that its gradient is correct. */
$(document).ready(function(){
	$(window).resize(function(e)
	{
		$("body").css("min-height", window.innerHeight);
	});
	
	$("body").css("min-height", window.innerHeight);
});
