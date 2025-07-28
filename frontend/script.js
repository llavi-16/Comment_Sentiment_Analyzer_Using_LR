document.addEventListener("DOMContentLoaded", () => {
    // --- Get DOM Elements ---
    const urlInput = document.getElementById('videoUrlInput');
    const analyzeButton = document.getElementById('analyzeButton');
    const errorMessage = document.getElementById('errorMessage');
    const resultsSection = document.getElementById('resultsSection');
    const summaryContainer = document.getElementById('summaryContainer');
    const chartCanvas = document.getElementById('sentimentChart');

    let sentimentChart = null; // To hold the Chart.js instance

    // --- Add Event Listeners ---
    analyzeButton.addEventListener('click', handleAnalysis);
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAnalysis();
    });

    /**
     * Main function to handle the analysis process
     */
    async function handleAnalysis() {
        const url = urlInput.value.trim();
        if (!url) {
            showError("Oops! Please paste a YouTube URL to begin.");
            return;
        }

        setLoadingState(true);
        clearPreviousResults();

        try {
            // Replace with your deployed Render URL if applicable
            const backendUrl = "http://127.0.0.1:8000/analyze"; 
            const response = await fetch(backendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok) {
                // Use the 'detail' field from FastAPI for specific errors
                throw new Error(data.detail || "An unexpected error occurred.");
            }
            
            displayResults(data);

        } catch (error) {
            console.error("Analysis failed:", error);
            showError(`Error: ${error.message}`);
        } finally {
            setLoadingState(false);
        }
    }

    /**
     * Renders the results on the page.
     * @param {object} data - The sentiment data { positive: number, negative: number }
     */
    function displayResults(data) {
        resultsSection.style.display = 'flex';
        // Use a short delay to allow the CSS transition to be visible
        setTimeout(() => resultsSection.classList.add('visible'), 10);

        const { positive, negative } = data;
        const total = positive + negative;

        if (total === 0) {
            summaryContainer.innerHTML = '<h3>No comments were found to analyze.</h3>';
            return;
        }

        // Update summary text
        summaryContainer.innerHTML = `
            <h3>Sentiment Breakdown</h3>
            <div class="stat">
                <i class="fa-solid fa-face-smile stat-icon positive"></i>
                <div>
                    <strong>${positive} Positive</strong>
                    <small>(${((positive / total) * 100).toFixed(1)}%)</small>
                </div>
            </div>
            <div class="stat">
                <i class="fa-solid fa-face-frown stat-icon negative"></i>
                 <div>
                    <strong>${negative} Negative</strong>
                    <small>(${((negative / total) * 100).toFixed(1)}%)</small>
                </div>
            </div>
        `;
        
        // Create or update the pie chart
        renderPieChart(data);
    }

    /**
     * Renders a pie chart with Chart.js
     * @param {object} data - The sentiment data
     */
    function renderPieChart(data) {
        if (sentimentChart) {
            sentimentChart.destroy();
        }

        sentimentChart = new Chart(chartCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Negative'],
                datasets: [{
                    data: [data.positive, data.negative],
                    backgroundColor: ['#20c997', '#fd7e14'],
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    borderWidth: 4,
                    hoverOffset: 10,
                }]
            },
            options: {
                responsive: true,
                cutout: '70%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        titleFont: { size: 14, weight: 'bold' },
                        bodyFont: { size: 12 },
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true
                }
            }
        });
    }

    // --- UI Helper Functions ---
    function setLoadingState(isLoading) {
        analyzeButton.disabled = isLoading;
        analyzeButton.innerHTML = isLoading 
            ? '<i class="fa-solid fa-spinner fa-spin"></i>' 
            : '<i class="fa-solid fa-magnifying-glass"></i><span>Analyze</span>';
    }

    function showError(message) {
        errorMessage.textContent = message;
        // The error message will fade out after 5 seconds
        setTimeout(() => errorMessage.textContent = '', 5000);
    }
    
    function clearPreviousResults() {
        errorMessage.textContent = '';
        resultsSection.classList.remove('visible');
        // A delay is needed to allow the fade-out animation to complete before hiding the element
        setTimeout(() => {
            if (!resultsSection.classList.contains('visible')) {
                 resultsSection.style.display = 'none';
                 summaryContainer.innerHTML = '';
            }
        }, 500);
    }
});
