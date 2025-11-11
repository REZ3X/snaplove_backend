const crypto = require('crypto');
const axios = require('axios');

class DuitkuService {
    constructor() {
        this.merchantCode = process.env.DUITKU_MERCHANT_CODE;
        this.apiKey = process.env.DUITKU_API_KEY;
        this.isProduction = process.env.NODE_ENV === 'production';

        this.baseURL = this.isProduction
            ? 'https://passport.duitku.com/webapi/api/merchant'
            : 'https://sandbox.duitku.com/webapi/api/merchant';
    }

    /**
     * Generate MD5 signature for transaction request
     */
    generateSignature(merchantCode, merchantOrderId, paymentAmount, apiKey) {
        const signatureString = `${merchantCode}${merchantOrderId}${paymentAmount}${apiKey}`;
        return crypto.createHash('md5').update(signatureString).digest('hex');
    }

    /**
     * Generate SHA256 signature for get payment method
     */
    generateSHA256Signature(merchantCode, paymentAmount, datetime, apiKey) {
        const signatureString = `${merchantCode}${paymentAmount}${datetime}${apiKey}`;
        return crypto.createHash('sha256').update(signatureString).digest('hex');
    }

    /**
     * Validate callback signature
     */
    validateCallbackSignature(merchantCode, amount, merchantOrderId, signature) {
        const calculatedSignature = crypto
            .createHash('md5')
            .update(`${merchantCode}${amount}${merchantOrderId}${this.apiKey}`)
            .digest('hex');

        return signature === calculatedSignature;
    }

    /**
     * Get available payment methods
     */
    async getPaymentMethods(amount = 45000) {
        try {
            const datetime = new Date().toISOString().replace('T', ' ').substring(0, 19);
            const signature = this.generateSHA256Signature(
                this.merchantCode,
                amount,
                datetime,
                this.apiKey
            );

            const response = await axios.post(
                `${this.baseURL}/paymentmethod/getpaymentmethod`,
                {
                    merchantcode: this.merchantCode,
                    amount,
                    datetime,
                    signature
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (response.data.responseCode === '00') {
                return {
                    success: true,
                    data: response.data.paymentFee
                };
            }

            return {
                success: false,
                message: response.data.responseMessage
            };
        } catch (error) {
            console.error('Duitku Get Payment Methods Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.Message || error.message
            };
        }
    }

    /**
     * Create transaction request
     */
    async createTransaction(data) {
        try {
            const {
                merchantOrderId,
                paymentAmount,
                paymentMethod,
                customerDetail,
                callbackUrl,
                returnUrl,
                expiryPeriod = 1440 } = data;

            const signature = this.generateSignature(
                this.merchantCode,
                merchantOrderId,
                paymentAmount,
                this.apiKey
            );

            const itemDetails = [
                {
                    name: 'Snaplove Premium Subscription - 1 Month',
                    price: paymentAmount,
                    quantity: 1
                }
            ];

            const payload = {
                merchantCode: this.merchantCode,
                paymentAmount,
                paymentMethod,
                merchantOrderId,
                productDetails: 'Snaplove Premium Subscription - 1 Month',
                customerVaName: customerDetail.firstName + ' ' + customerDetail.lastName,
                email: customerDetail.email,
                phoneNumber: customerDetail.phoneNumber || '-',
                itemDetails,
                customerDetail,
                callbackUrl,
                returnUrl,
                signature,
                expiryPeriod
            };

            console.log('Duitku API Request:', {
                url: `${this.baseURL}/v2/inquiry`,
                payload: JSON.stringify(payload, null, 2)
            });

            const response = await axios.post(
                `${this.baseURL}/v2/inquiry`,
                payload,
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('Duitku API Response:', response.data);

            if (response.data.statusCode === '00') {
                return {
                    success: true,
                    data: {
                        merchantCode: response.data.merchantCode,
                        reference: response.data.reference,
                        paymentUrl: response.data.paymentUrl,
                        vaNumber: response.data.vaNumber,
                        qrString: response.data.qrString,
                        amount: response.data.amount,
                        statusMessage: response.data.statusMessage
                    }
                };
            }

            console.log('Duitku transaction failed:', response.data);
            return {
                success: false,
                message: response.data.statusMessage
            };
        } catch (error) {
            console.error('Duitku Create Transaction Error:', error.response?.data || error.message);
            console.error('Full error details:', {
                status: error.response?.status,
                statusText: error.response?.statusText,
                data: error.response?.data
            });
            return {
                success: false,
                message: error.response?.data?.Message || error.response?.data?.statusMessage || error.message
            };
        }
    }

    /**
     * Check transaction status
     */
    async checkTransactionStatus(merchantOrderId) {
        try {
            const signature = this.generateSignature(
                this.merchantCode,
                merchantOrderId,
                0, this.apiKey
            );

            const response = await axios.post(
                `${this.baseURL}/transactionStatus`,
                {
                    merchantCode: this.merchantCode,
                    merchantOrderId,
                    signature
                },
                {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                }
            );

            return {
                success: true,
                data: {
                    merchantOrderId: response.data.merchantOrderId,
                    reference: response.data.reference,
                    amount: response.data.amount,
                    fee: response.data.fee,
                    statusCode: response.data.statusCode,
                    statusMessage: response.data.statusMessage
                }
            };
        } catch (error) {
            console.error('Duitku Check Status Error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.Message || error.message
            };
        }
    }

    /**
     * Process callback from Duitku
     */
    processCallback(callbackData) {
        const {
            merchantCode,
            amount,
            merchantOrderId,
            _productDetail,
            _additionalParam,
            paymentCode,
            resultCode,
            merchantUserId,
            reference,
            signature,
            publisherOrderId,
            _spUserHash,
            settlementDate,
            issuerCode
        } = callbackData;

        const isValid = this.validateCallbackSignature(
            merchantCode,
            amount,
            merchantOrderId,
            signature
        );

        if (!isValid) {
            return {
                success: false,
                message: 'Invalid signature'
            };
        }

        let status = 'pending';
        if (resultCode === '00') {
            status = 'success';
        } else if (resultCode === '01') {
            status = 'failed';
        }

        return {
            success: true,
            data: {
                merchantOrderId,
                reference,
                amount: parseInt(amount),
                paymentCode,
                status,
                publisherOrderId,
                settlementDate,
                issuerCode,
                merchantUserId
            }
        };
    }

    /**
     * Request a refund for a transaction
     * Note: This is a simplified implementation. Actual Duitku refund API may differ
     */
    async requestRefund({ reference, amount, reason = 'Customer requested cancellation' }) {
        try {
            console.log(`🔄 Requesting refund for reference: ${reference}`);



            const refundData = {
                merchantCode: this.merchantCode,
                reference,
                amount,
                reason
            };


            const signature = crypto
                .createHash('md5')
                .update(`${this.merchantCode}${reference}${amount}${this.apiKey}`)
                .digest('hex');

            refundData.signature = signature;



            if (this.isProduction) {
                const response = await axios.post(`${this.baseURL}/refund`, refundData, {
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.data && response.data.statusCode === '00') {
                    return {
                        success: true,
                        data: {
                            refundReference: response.data.refundReference || `REF-${Date.now()}`,
                            status: 'processed',
                            message: 'Refund processed successfully'
                        }
                    };
                } else {
                    throw new Error(response.data?.statusMessage || 'Refund request failed');
                }
            } else {

                console.log('⚠️ Sandbox mode: Simulating refund approval');
                return {
                    success: true,
                    data: {
                        refundReference: `SANDBOX-REF-${Date.now()}`,
                        status: 'processed',
                        message: 'Refund processed successfully (sandbox mode)'
                    }
                };
            }
        } catch (error) {
            console.error('❌ Refund request error:', error.message);
            return {
                success: false,
                message: error.message || 'Failed to process refund',
                error: error.response?.data || error.message
            };
        }
    }

    /**
     * Check refund status
     */
    async checkRefundStatus(refundReference) {
        try {
            if (!this.isProduction) {

                return {
                    success: true,
                    data: {
                        refundReference,
                        status: 'processed',
                        message: 'Refund completed (sandbox)'
                    }
                };
            }


            const response = await axios.get(`${this.baseURL}/refund/status/${refundReference}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            return {
                success: true,
                data: response.data
            };
        } catch (error) {
            console.error('❌ Check refund status error:', error.message);
            return {
                success: false,
                message: 'Failed to check refund status'
            };
        }
    }
}

module.exports = new DuitkuService();
