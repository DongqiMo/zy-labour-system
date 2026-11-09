/* Retired first-machine snapshots. Keep business source/review metadata intact. */
(function(root){
 function clean(record){const copy={...record};delete copy.firstRecognition;return copy}
 root.ZYRecognitionArchive={clean,cleanOrders:records=>records.map(clean)};
})(globalThis);
