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
            // FIXED: The endpoint /analyze has been added to the URL
            const backendUrl = "https://comment-sentiment-analyzer.onrender.com/analyze"; 
            const response = await fetch(backendUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });

            const data = await response.json();

            if (!response.ok) {
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
     */
    function displayResults(data) {
        resultsSection.style.display = 'flex';
        setTimeout(() => resultsSection.classList.add('visible'), 10);

        // UPDATED: Now includes the 'neutral' category from the backend
        const { positive, neutral, negative } = data;
        const total = positive + neutral + negative;

        if (total === 0) {
            summaryContainer.innerHTML = '<h3>No comments were found to analyze.</h3>';
            chartCanvas.style.display = 'none'; // Hide chart if no comments
            return;
        }
        chartCanvas.style.display = 'block';

        // UPDATED: Summary now includes neutral stats and icon
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
                <i class="fa-solid fa-face-meh stat-icon neutral"></i>
                <div>
                    <strong>${neutral} Neutral</strong>
                    <small>(${((neutral / total) * 100).toFixed(1)}%)</small>
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
        
        renderPieChart(data);
    }

    /**
     * Renders a pie chart with Chart.js
     */
    function renderPieChart(data) {
        if (sentimentChart) {
            sentimentChart.destroy();
        }
        
        // UPDATED: Chart now includes neutral data and colors
        sentimentChart = new Chart(chartCanvas.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Positive', 'Neutral', 'Negative'],
                datasets: [{
                    data: [data.positive, data.neutral, data.negative],
                    backgroundColor: [
                        '#20c997', // Positive
                        '#6c757d', // Neutral
                        '#fd7e14'  // Negative
                    ],
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
        setTimeout(() => errorMessage.textContent = '', 5000);
    }
    
    function clearPreviousResults() {
        errorMessage.textContent = '';
        resultsSection.classList.remove('visible');
        setTimeout(() => {
            if (!resultsSection.classList.contains('visible')) {
                 resultsSection.style.display = 'none';
                 summaryContainer.innerHTML = '';
            }
        }, 500);
    }
});
